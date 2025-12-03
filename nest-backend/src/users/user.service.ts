import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async findByEmailOrUsername(identifier: string) {
    const normalized = identifier.trim().toLowerCase();
    return this.userModel
      .findOne({
        $or: [{ email: normalized }, { username: normalized }],
      })
      .exec();
  }

  async emailExists(email: string) {
    return this.userModel.exists({ email: email.trim().toLowerCase() });
  }

  async usernameExists(username: string) {
    return this.userModel.exists({ username: username.trim().toLowerCase() });
  }

  async createUser(payload: Partial<User>) {
    return this.userModel.create(payload);
  }
}
