import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument } from './schemas/agent.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async apply(userId: string, agentType: 'seller' | 'service') {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'AGENT') throw new BadRequestException('Already agent');
    const existing = await this.agentModel.findOne({ user: userId });
    if (existing) throw new BadRequestException('Application exists');
    const agent = await this.agentModel.create({ user: userId, agentType, verificationStatus: 'pending' });
    user.role = 'AGENT';
    await user.save();
    return agent;
  }

  async uploadFace(userId: string, url: string) {
    const agent = await this.agentModel.findOne({ user: userId });
    if (!agent) throw new NotFoundException('Agent not found');
    agent.faceIdImageUrl = url;
    await agent.save();
    return agent;
  }

  async me(userId: string) {
    const agent = await this.agentModel.findOne({ user: userId }).populate('user');
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async listVerified() {
    return this.agentModel.find({ verificationStatus: 'verified', blocked: { $ne: true } }).populate('user');
  }
}
