import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { User } from '../users/schemas/user.schema';
import { Agent } from '../agents/schemas/agent.schema';
import { Listing } from '../listings/schemas/listing.schema';
import { Post } from '../feed/schemas/post.schema';
import { Service } from '../services/schemas/service.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Agent.name) private readonly agentModel: Model<Agent>,
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(Service.name) private readonly serviceModel: Model<Service>,
  ) {}

  @Get('users')
  users() {
    return this.userModel.find();
  }

  @Get('agents')
  agents() {
    return this.agentModel.find();
  }

  @Put('agents/:id/verify')
  verifyAgent(@Param('id') id: string) {
    return this.agentModel.findByIdAndUpdate(id, { verificationStatus: 'verified' }, { new: true });
  }

  @Put('agents/:id/reject')
  rejectAgent(@Param('id') id: string) {
    return this.agentModel.findByIdAndUpdate(id, { verificationStatus: 'rejected' }, { new: true });
  }

  @Put('agents/:id/block')
  blockAgent(@Param('id') id: string, @Body('blocked') blocked: boolean) {
    return this.agentModel.findByIdAndUpdate(id, { blocked: !!blocked }, { new: true });
  }

  @Get('listings')
  listings() {
    return this.listingModel.find();
  }

  @Delete('listings/:id')
  deleteListing(@Param('id') id: string) {
    return this.listingModel.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
  }

  @Get('posts')
  posts() {
    return this.postModel.find();
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.postModel.findByIdAndDelete(id);
  }

  @Get('stats')
  async stats() {
    const [totalUsers, totalAgents, totalListings, totalServices, totalPosts] = await Promise.all([
      this.userModel.countDocuments(),
      this.agentModel.countDocuments(),
      this.listingModel.countDocuments(),
      this.serviceModel.countDocuments(),
      this.postModel.countDocuments(),
    ]);
    return { totalUsers, totalAgents, totalListings, totalServices, totalPosts };
  }
}
