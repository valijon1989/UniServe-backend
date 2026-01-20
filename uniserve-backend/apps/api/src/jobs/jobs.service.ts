import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JobListing, JobListingDocument } from './schemas/job-listing.schema';
import { JobInquiry, JobInquiryDocument } from './schemas/job-inquiry.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(JobListing.name) private readonly jobModel: Model<JobListingDocument>,
    @InjectModel(JobInquiry.name) private readonly inquiryModel: Model<JobInquiryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  listCategories() {
    return [
      { name: 'Doimiy ishlar', slug: 'doimiy-ishlar' },
      { name: 'Vaqtinchalik ishlar', slug: 'vaqtinchalik-ishlar' },
    ];
  }

  async create(employerId: string, data: any) {
    const payload = this.normalizePayload(data);
    this.validatePayload(payload);

    return this.jobModel.create({
      ...payload,
      employer: new Types.ObjectId(employerId),
    });
  }

  async list(query: any = {}) {
    const filters: any = { status: 'active' };

    if (query.category) {
      const category = String(query.category);
      if (!this.isAllowedCategory(category)) throw new BadRequestException('Invalid category');
      filters.categorySlug = category;
    }

    if (query.payType) {
      const payType = String(query.payType);
      if (!this.isAllowedPayType(payType)) throw new BadRequestException('Invalid pay type');
      filters.payType = payType;
    }

    const minPay = this.toNumber(query.minPay);
    const maxPay = this.toNumber(query.maxPay);
    if (minPay !== undefined || maxPay !== undefined) {
      filters.payAmount = {};
      if (minPay !== undefined) filters.payAmount.$gte = minPay;
      if (maxPay !== undefined) filters.payAmount.$lte = maxPay;
    }

    const housingProvided = this.toBoolean(query.housingProvided);
    if (housingProvided !== undefined) filters.housingProvided = housingProvided;

    const mealsProvided = this.toBoolean(query.mealsProvided);
    if (mealsProvided !== undefined) filters.mealsProvided = mealsProvided;

    const visaTypes = this.toStringArray(query.visaTypes);
    if (visaTypes.length) filters.visaTypes = { $in: visaTypes };

    const search = typeof query.q === 'string' ? query.q.trim() : '';
    if (search) {
      filters.$text = { $search: search };
    }

    const geoFilter = this.buildGeoFilter(query);
    if (geoFilter) {
      filters.locationGeo = geoFilter;
    }

    const limit = Math.max(1, Math.min(50, this.toNumber(query.limit) || 4));
    const page = Math.max(1, this.toNumber(query.page) || 1);
    const skip = (page - 1) * limit;
    const sort = this.mapSort(query.sort);

    const [items, total] = await Promise.all([
      this.jobModel
        .find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('employer')
        .lean(),
      this.jobModel.countDocuments(filters),
    ]);

    return {
      items: items.map((job) => this.buildJobResponse(job)),
      total,
      page,
      limit,
    };
  }

  async byId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id');
    const job = await this.jobModel.findById(id).populate('employer').lean();
    if (!job) throw new NotFoundException('Job not found');
    return this.buildJobResponse(job);
  }

  async contact(jobId: string, senderId: string, message: string) {
    if (!message || !String(message).trim()) {
      throw new BadRequestException('Message required');
    }
    if (!Types.ObjectId.isValid(jobId)) throw new BadRequestException('Invalid job id');
    const job = await this.jobModel.findById(jobId).select('_id status').lean();
    if (!job || job.status !== 'active') throw new NotFoundException('Job not found');
    return this.inquiryModel.create({
      job: job._id,
      sender: new Types.ObjectId(senderId),
      message: String(message).trim(),
    });
  }

  private normalizePayload(data: any) {
    const payload = { ...(data || {}) };

    if (!payload.categorySlug && payload.category) {
      payload.categorySlug = payload.category;
    }

    if (!payload.workAddress && payload.address) {
      payload.workAddress = payload.address;
    }

    if (payload.payAmount !== undefined) {
      const amount = this.toNumber(payload.payAmount);
      if (amount !== undefined) payload.payAmount = amount;
    }

    if (payload.lat !== undefined && payload.lng !== undefined) {
      const lat = this.toNumber(payload.lat);
      const lng = this.toNumber(payload.lng);
      if (lat !== undefined && lng !== undefined) {
        payload.locationGeo = { type: 'Point', coordinates: [lng, lat] };
      }
    }

    if (!payload.locationGeo && payload.location && typeof payload.location === 'object') {
      const lat = this.toNumber(payload.location.lat);
      const lng = this.toNumber(payload.location.lng);
      if (lat !== undefined && lng !== undefined) {
        payload.locationGeo = { type: 'Point', coordinates: [lng, lat] };
      }
    }

    payload.requirements = this.toStringArray(payload.requirements);
    payload.visaTypes = this.toStringArray(payload.visaTypes);

    return payload;
  }

  private validatePayload(payload: any) {
    const requiredFields = ['title', 'description', 'categorySlug', 'jobType', 'workAddress', 'payType', 'payAmount'];
    requiredFields.forEach((field) => {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        throw new BadRequestException(`Field ${field} is required`);
      }
    });

    if (!this.isAllowedCategory(payload.categorySlug)) throw new BadRequestException('Invalid category');
    if (!this.isAllowedPayType(payload.payType)) throw new BadRequestException('Invalid pay type');
    if (Number(payload.payAmount) <= 0) throw new BadRequestException('Invalid pay amount');
    if (!payload.currency) payload.currency = 'KRW';
  }

  private buildGeoFilter(query: any) {
    const lat = this.toNumber(query.lat);
    const lng = this.toNumber(query.lng);
    if (lat === undefined || lng === undefined) return null;
    const radiusKm = this.toNumber(query.radiusKm) || 50;
    return {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: Math.max(1, radiusKm) * 1000,
      },
    };
  }

  private buildJobResponse(job: any) {
    const employer = job.employer || {};
    return {
      id: job._id,
      title: job.title,
      description: job.description,
      categorySlug: job.categorySlug,
      jobType: job.jobType,
      workAddress: job.workAddress,
      locationGeo: job.locationGeo,
      workTime: job.workTime,
      payType: job.payType,
      payAmount: job.payAmount,
      currency: job.currency,
      housingProvided: job.housingProvided,
      mealsProvided: job.mealsProvided,
      requirements: job.requirements || [],
      visaTypes: job.visaTypes || [],
      status: job.status,
      createdAt: job.createdAt,
      employer: {
        id: employer._id,
        name: employer.name,
        avatarUrl: employer.avatarUrl,
      },
    };
  }

  private mapSort(sort?: string) {
    const normalized = String(sort || '').toLowerCase();
    if (normalized === 'pay_high') return { payAmount: -1, _id: -1 };
    if (normalized === 'pay_low') return { payAmount: 1, _id: -1 };
    return { createdAt: -1, _id: -1 };
  }

  private toNumber(value: any) {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private toBoolean(value: any) {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === false) return value;
    const normalized = String(value).toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return undefined;
  }

  private toStringArray(value: any) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  private isAllowedCategory(category: string) {
    return ['doimiy-ishlar', 'vaqtinchalik-ishlar'].includes(String(category));
  }

  private isAllowedPayType(payType: string) {
    return ['hourly', 'daily', 'weekly', 'monthly'].includes(String(payType));
  }
}
