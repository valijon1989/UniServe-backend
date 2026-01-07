import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    meta?: Record<string, any>,
  ) {
    return this.notificationModel.create({ user: userId, type, title, body, meta });
  }

  async createForUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    meta?: Record<string, any>,
  ) {
    if (!userIds.length) return [];
    const payload = userIds.map((userId) => ({ user: userId, type, title, body, meta }));
    return this.notificationModel.insertMany(payload);
  }

  async listForUser(userId: string, limit = 50, unreadOnly = false) {
    const filter: Record<string, any> = { user: userId };
    if (unreadOnly) {
      filter.isRead = false;
    }
    return this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async markAllRead(userId: string) {
    return this.notificationModel.updateMany({ user: userId }, { isRead: true }).exec();
  }
}
