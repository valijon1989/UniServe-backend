import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './users/schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiService implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async onModuleInit() {
    const email = 'admin@uniserv.com';
    const exists = await this.userModel.findOne({ email });
    if (!exists) {
      const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
      const hash = await bcrypt.hash(password, 10);
      await this.userModel.create({
        name: 'Default Admin',
        email,
        password: hash,
        role: 'ADMIN',
        profileVisibility: 'public',
      });
      console.log('✅ Default admin created');
    }
  }
}
