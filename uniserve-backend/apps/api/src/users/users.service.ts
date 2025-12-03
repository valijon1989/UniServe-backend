import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(data: Partial<User>): Promise<User> {
    return this.userModel.create(data);
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const id = identifier.trim().toLowerCase();
    return this.userModel.findOne({ $or: [{ email: id }, { name: id }] });
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  async follow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) throw new BadRequestException("Can't follow yourself");
    const current = await this.userModel.findById(currentUserId);
    const target = await this.userModel.findById(targetUserId);
    if (!current || !target) throw new NotFoundException('User not found');
    if (current.following?.some((f) => f.toString() === targetUserId)) return { ok: true };
    current.following = [...(current.following || []), new Types.ObjectId(targetUserId)];
    target.followers = [...(target.followers || []), new Types.ObjectId(currentUserId)];
    await current.save();
    await target.save();
    return { ok: true };
  }

  async unfollow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) throw new BadRequestException("Can't unfollow yourself");
    const current = await this.userModel.findById(currentUserId);
    const target = await this.userModel.findById(targetUserId);
    if (!current || !target) throw new NotFoundException('User not found');
    current.following = (current.following || []).filter((id) => id.toString() !== targetUserId);
    target.followers = (target.followers || []).filter((id) => id.toString() !== currentUserId);
    await current.save();
    await target.save();
    return { ok: true };
  }

  async listFollowers(userId: string) {
    const user = await this.userModel.findById(userId).populate('followers', 'name email role');
    if (!user) throw new NotFoundException('User not found');
    return user.followers;
  }

  async listFollowing(userId: string) {
    const user = await this.userModel.findById(userId).populate('following', 'name email role');
    if (!user) throw new NotFoundException('User not found');
    return user.following;
  }
}
