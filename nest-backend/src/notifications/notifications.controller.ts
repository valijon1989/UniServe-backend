import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 50;
    const onlyUnread = unreadOnly === 'true';
    return this.notifications.listForUser(user.userId, parsedLimit, onlyUnread);
  }

  @UseGuards(JwtAuthGuard)
  @Post('read-all')
  async markAllRead(@CurrentUser() user: { userId: string }) {
    await this.notifications.markAllRead(user.userId);
    return { ok: true };
  }
}
