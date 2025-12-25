import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { Service, ServiceSchema } from './schemas/service.schema';
import { ServiceCategory, ServiceCategorySchema } from './schemas/service-category.schema';
import { ServiceReaction, ServiceReactionSchema } from './schemas/service-reaction.schema';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CommonModule } from '../common/common.module';
import { ServiceCategoriesController } from './service-categories.controller';
import { ProvidersController } from './providers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: ServiceCategory.name, schema: ServiceCategorySchema },
      { name: ServiceReaction.name, schema: ServiceReactionSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CommonModule,
  ],
  providers: [ServicesService],
  controllers: [ServicesController, ServiceCategoriesController, ProvidersController],
  exports: [ServicesService],
})
export class ServicesModule {}
