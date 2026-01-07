import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Injectable()
export class DeliveryReviewScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryReviewScheduler.name);
  private interval?: NodeJS.Timeout;

  constructor(private readonly delivery: DeliveryService) {}

  onModuleInit() {
    this.interval = setInterval(async () => {
      try {
        const { approved, escalated } = await this.delivery.autoReviewPendingApplications();
        if (approved.length || escalated.length) {
          this.logger.log(
            `Auto-review processed: approved=${approved.length}, escalated=${escalated.length}`,
          );
        }
      } catch (error) {
        this.logger.error('Auto-review failed', error as Error);
      }
    }, 15000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
