import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';
import { Listing, ListingSchema } from '../listings/schemas/listing.schema';
import { Post, PostSchema } from '../feed/schemas/post.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Post.name, schema: PostSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    CommonModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
