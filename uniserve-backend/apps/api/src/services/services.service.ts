import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { ServiceCategory, ServiceCategoryDocument } from './schemas/service-category.schema';
import { Agent, AgentDocument } from '../agents/schemas/agent.schema';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(ServiceCategory.name) private readonly categoryModel: Model<ServiceCategoryDocument>,
    @InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>,
  ) {}

  async createCategory(data: Partial<ServiceCategory>) {
    return this.categoryModel.create(data);
  }

  async createService(agentUserId: string, data: Partial<Service>) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    return this.serviceModel.create({ ...data, agent: agent._id });
  }

  async myServices(agentUserId: string) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    return this.serviceModel.find({ agent: agent._id });
  }

  async updateService(agentUserId: string, id: string, data: Partial<Service>) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    const svc = await this.serviceModel.findOneAndUpdate({ _id: id, agent: agent._id }, data, { new: true });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async deleteService(agentUserId: string, id: string) {
    return this.updateService(agentUserId, id, { status: 'inactive' } as any);
  }

  async listPublic(filters: any = {}) {
    return this.serviceModel
      .find({ status: 'active', ...filters })
      .populate('category')
      .populate({ path: 'agent', populate: { path: 'user' } });
  }

  async byId(id: string) {
    const svc = await this.serviceModel.findById(id).populate('category').populate({ path: 'agent', populate: 'user' });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }
}
