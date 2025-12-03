import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Listing, ListingDocument } from './schemas/listing.schema';
import { Agent, AgentDocument } from '../agents/schemas/agent.schema';

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name) private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>,
  ) {}

  async create(agentUserId: string, data: Partial<Listing>) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    return this.listingModel.create({ ...data, agent: agent._id });
  }

  async my(agentUserId: string) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    return this.listingModel.find({ agent: agent._id });
  }

  async update(agentUserId: string, id: string, data: Partial<Listing>) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    const item = await this.listingModel.findOneAndUpdate({ _id: id, agent: agent._id }, data, { new: true });
    if (!item) throw new NotFoundException('Listing not found');
    return item;
  }

  async markSold(agentUserId: string, id: string) {
    return this.update(agentUserId, id, { status: 'sold' } as any);
  }

  async delete(agentUserId: string, id: string) {
    return this.update(agentUserId, id, { status: 'deleted' } as any);
  }

  async list(filters: any = {}) {
    return this.listingModel
      .find({ status: 'active', ...filters })
      .populate({ path: 'agent', populate: 'user' });
  }

  async byId(id: string) {
    const item = await this.listingModel.findById(id).populate({ path: 'agent', populate: 'user' });
    if (!item) throw new NotFoundException('Listing not found');
    return item;
  }
}
