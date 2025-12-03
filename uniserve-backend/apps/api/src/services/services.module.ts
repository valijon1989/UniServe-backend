import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { Service, ServiceSchema } from './schemas/service.schema';
import { ServiceCategory, ServiceCategorySchema } from './schemas/service-category.schema';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: ServiceCategory.name, schema: ServiceCategorySchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    CommonModule,
  ],
  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [ServicesService],
})
export class ServicesModule {}
