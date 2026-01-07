import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../users/user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AgentApplication, AgentApplicationDocument } from './schemas/agent-application.schema';
import { AgentProfile, AgentProfileDocument } from './schemas/agent-profile.schema';
import { ApplyAgentDto } from './dto/apply-agent.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { UpdateAgentStatusDto } from './dto/update-agent-status.dto';

const REVIEW_WINDOW_MS = 60 * 1000;
const ESCALATION_WINDOW_MS = 120 * 1000;

@Injectable()
export class DeliveryService {
  constructor(
    @InjectModel(AgentApplication.name)
    private readonly applicationModel: Model<AgentApplicationDocument>,
    @InjectModel(AgentProfile.name)
    private readonly profileModel: Model<AgentProfileDocument>,
    private readonly users: UserService,
    private readonly notifications: NotificationsService,
  ) {}

  async submitApplication(userId: string, dto: ApplyAgentDto) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.validateApplication(dto);

    const now = new Date();
    const reviewDeadlineAt = new Date(now.getTime() + REVIEW_WINDOW_MS);
    const escalationAt = new Date(now.getTime() + ESCALATION_WINDOW_MS);

    const payload = {
      user: user.id,
      status: 'PENDING' as const,
      requestedTypes: dto.requestedTypes,
      phoneNumber: dto.phoneNumber,
      email: user.email,
      telegramHandle: dto.telegramHandle,
      address: dto.address,
      idDocumentUrl: dto.idDocumentUrl,
      selfieUrl: dto.selfieUrl,
      faceMatchScore: dto.faceMatchScore,
      faceVerified: this.isFaceVerified(dto.faceMatchScore),
      paymentAccountNumber: dto.paymentAccountNumber,
      vehiclePlate: dto.vehiclePlate,
      smsCode: dto.smsCode,
      smsVerified: this.isSmsVerified(dto.smsCode),
      serviceRegions: dto.serviceRegions,
      baseFee: dto.baseFee,
      routes: dto.routes,
      maxWeightKg: dto.maxWeightKg,
      productTypes: dto.productTypes,
      deliveryModes: dto.deliveryModes,
      departureDates: dto.departureDates,
      reviewDeadlineAt,
      escalationAt,
    };

    return this.applicationModel
      .findOneAndUpdate({ user: user.id }, payload, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .exec();
  }

  async getMyApplication(userId: string) {
    return this.applicationModel.findOne({ user: userId }).exec();
  }

  async listApplications(adminId: string, status?: string) {
    await this.assertAdmin(adminId);
    const filter: Record<string, any> = {};
    if (status) {
      filter.status = status;
    }
    return this.applicationModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async reviewApplication(adminId: string, applicationId: string, dto: ReviewApplicationDto) {
    await this.assertAdmin(adminId);

    const application = await this.applicationModel.findById(applicationId).exec();
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'PENDING') {
      throw new BadRequestException('Application is not pending');
    }

    application.status = dto.status;
    if (dto.adminNote) {
      application.adminNote = dto.adminNote;
    }

    if (dto.status === 'APPROVED') {
      await this.approveApplication(application);
      await this.notifications.create(
        String(application.user),
        'AGENT_APPLICATION_APPROVED',
        'Agent arizasi tasdiqlandi',
        'Arizangiz tasdiqlandi. Endi xizmatni boshlashingiz mumkin.',
        { applicationId: application.id },
      );
    } else if (dto.status === 'REJECTED') {
      await this.notifications.create(
        String(application.user),
        'AGENT_APPLICATION_REJECTED',
        'Agent arizasi rad etildi',
        "Arizangiz rad etildi. Iltimos, admin bilan bog'laning.",
        { applicationId: application.id, adminNote: dto.adminNote },
      );
    }

    await application.save();

    return application;
  }

  async updateAgentStatus(adminId: string, agentId: string, dto: UpdateAgentStatusDto) {
    await this.assertAdmin(adminId);

    const profile = await this.profileModel
      .findByIdAndUpdate(agentId, dto, { new: true })
      .exec();
    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }
    return profile;
  }

  async listAgents(query: {
    type?: string;
    region?: string;
    fromCountry?: string;
    toCountry?: string;
    limit?: string;
  }) {
    const filter: Record<string, any> = { status: 'ACTIVE' };

    if (query.type) {
      filter.types = query.type;
    }

    if (query.region) {
      filter.$or = [
        { 'localProfile.serviceRegions': query.region },
        { 'internationalProfile.routes.fromRegion': query.region },
        { 'internationalProfile.routes.toRegion': query.region },
      ];
    }

    if (query.fromCountry || query.toCountry) {
      filter['internationalProfile.routes'] = {
        $elemMatch: {
          ...(query.fromCountry ? { fromCountry: query.fromCountry } : {}),
          ...(query.toCountry ? { toCountry: query.toCountry } : {}),
        },
      };
    }

    const limit = query.limit ? Number(query.limit) : 50;

    const profiles = await this.profileModel
      .find(filter)
      .sort({ ratingAvg: -1, completedServices: -1, lastActiveAt: -1 })
      .limit(limit)
      .exec();

    return profiles.map((profile) => this.toPublicAgent(profile));
  }

  async getAgent(agentId: string) {
    const profile = await this.profileModel.findById(agentId).exec();
    if (!profile) {
      throw new NotFoundException('Agent profile not found');
    }
    return this.toPublicAgent(profile);
  }

  async autoReviewPendingApplications() {
    const now = new Date();
    const approved: string[] = [];
    const escalated: string[] = [];

    const pendingForReview = await this.applicationModel
      .find({
        status: 'PENDING',
        reviewDeadlineAt: { $lte: now },
      })
      .exec();

    for (const application of pendingForReview) {
      if (!this.isAutoApprovable(application)) {
        continue;
      }
      application.status = 'APPROVED';
      if (!application.adminNote) {
        application.adminNote = 'Auto-approved by system.';
      }
      await this.approveApplication(application);
      await application.save();
      await this.notifications.create(
        String(application.user),
        'AGENT_APPLICATION_APPROVED',
        'Agent arizasi tasdiqlandi',
        'Arizangiz avtomatik tasdiqlandi. Endi xizmatni boshlashingiz mumkin.',
        { applicationId: application.id },
      );
      approved.push(String(application.id));
    }

    const pendingForEscalation = await this.applicationModel
      .find({
        status: 'PENDING',
        escalationAt: { $lte: now },
        escalatedAt: { $exists: false },
      })
      .exec();

    for (const application of pendingForEscalation) {
      application.escalatedAt = now;
      if (!application.adminNote) {
        application.adminNote = 'Pending over SLA, escalated to admin.';
      }
      await application.save();
      await this.notifyEscalation(application);
      escalated.push(String(application.id));
    }

    return { approved, escalated };
  }

  private validateApplication(dto: ApplyAgentDto) {
    if (dto.requestedTypes.includes('LOCAL')) {
      if (!dto.vehiclePlate || !dto.smsCode) {
        throw new BadRequestException('Local agent requires vehicle plate and SMS code');
      }
    }

    if (dto.requestedTypes.includes('INTERNATIONAL')) {
      if (!dto.routes?.length || !dto.maxWeightKg || !dto.deliveryModes?.length) {
        throw new BadRequestException(
          'International agent requires routes, max weight, and delivery modes',
        );
      }
    }
  }

  private async assertAdmin(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  private toPublicAgent(profile: AgentProfileDocument) {
    const obj = profile.toObject();
    const { phoneNumber, email, telegramHandle, paymentAccountNumber, ...rest } = obj;

    const localProfile = rest.localProfile
      ? { ...rest.localProfile, idDocumentUrl: undefined }
      : undefined;
    const internationalProfile = rest.internationalProfile
      ? { ...rest.internationalProfile, idDocumentUrl: undefined }
      : undefined;

    return {
      ...rest,
      localProfile,
      internationalProfile,
      contactMasked: {
        phoneNumber: phoneNumber ? this.maskPhone(phoneNumber) : undefined,
      },
    };
  }

  private async approveApplication(application: AgentApplicationDocument) {
    await this.profileModel
      .findOneAndUpdate(
        { user: application.user },
        {
          user: application.user,
          status: 'ACTIVE',
          types: application.requestedTypes,
          paymentAccountNumber: application.paymentAccountNumber,
          phoneNumber: application.phoneNumber,
          email: application.email,
          telegramHandle: application.telegramHandle,
          address: application.address,
          localProfile: application.requestedTypes.includes('LOCAL')
            ? {
                vehiclePlate: application.vehiclePlate,
                serviceRegions: application.serviceRegions,
                baseFee: application.baseFee,
                idDocumentUrl: application.idDocumentUrl,
                faceImageUrl: application.selfieUrl,
                faceVerified: application.faceVerified,
                smsVerified: application.smsVerified,
              }
            : undefined,
          internationalProfile: application.requestedTypes.includes('INTERNATIONAL')
            ? {
                routes: application.routes,
                maxWeightKg: application.maxWeightKg,
                productTypes: application.productTypes,
                deliveryModes: application.deliveryModes,
                departureDates: application.departureDates,
                idDocumentUrl: application.idDocumentUrl,
                faceImageUrl: application.selfieUrl,
                faceVerified: application.faceVerified,
              }
            : undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    await this.users.updateById(String(application.user), { role: 'AGENT' });
  }

  private async notifyEscalation(application: AgentApplicationDocument) {
    const admins = await this.users.findAdmins();
    const adminIds = admins.map((admin) => String(admin.id));

    await this.notifications.createForUsers(
      adminIds,
      'AGENT_APPLICATION_ESCALATED',
      'Agent arizasi kechikdi',
      "Ariza SLA'dan oshdi. Iltimos, admin ko'rib chiqing.",
      { applicationId: application.id, userId: String(application.user) },
    );

    await this.notifications.create(
      String(application.user),
      'AGENT_APPLICATION_ESCALATED',
      'Ariza hali tasdiqlanmadi',
      "Arizangiz belgilangan vaqtda tasdiqlanmadi. Iltimos, admin bilan bog'laning.",
      { applicationId: application.id },
    );
  }

  private isFaceVerified(score?: number) {
    if (typeof score !== 'number') return false;
    return score >= 0.8;
  }

  private isSmsVerified(code?: string) {
    return !!code && code.trim().length === 5;
  }

  private isAutoApprovable(application: AgentApplicationDocument) {
    if (!application.faceVerified) return false;
    if (!application.paymentAccountNumber) return false;
    if (application.requestedTypes.includes('LOCAL')) {
      if (!application.vehiclePlate || !application.smsVerified) return false;
    }
    if (application.requestedTypes.includes('INTERNATIONAL')) {
      if (!application.routes?.length) return false;
      if (!application.maxWeightKg) return false;
      if (!application.deliveryModes?.length) return false;
    }
    return true;
  }

  private maskPhone(value: string) {
    const trimmed = value.trim();
    if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
    const visible = trimmed.slice(-4);
    return `${'*'.repeat(trimmed.length - 4)}${visible}`;
  }
}
