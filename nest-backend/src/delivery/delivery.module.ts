import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../users/user.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryReviewScheduler } from './delivery-review.scheduler';
import { AgentApplication, AgentApplicationSchema } from './schemas/agent-application.schema';
import { AgentProfile, AgentProfileSchema } from './schemas/agent-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentApplication.name, schema: AgentApplicationSchema },
      { name: AgentProfile.name, schema: AgentProfileSchema },
    ]),
    UserModule,
    NotificationsModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryReviewScheduler],
})
export class DeliveryModule {}
