import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, password: string) {
    const email = identifier.trim().toLowerCase();
    const user = await this.userModel.findOne({ email });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    return user;
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email });
    if (existing) throw new BadRequestException('Email already registered');
    const user = await this.userModel.create({
      name: dto.name,
      email,
      password: dto.password,
      role: 'USER',
      profileVisibility: 'public',
    });
    const token = this.signToken(user);
    return { accessToken: token, user };
  }

  async login(user: User) {
    const token = this.signToken(user);
    return { accessToken: token, user };
  }

  private signToken(user: User) {
    return this.jwtService.sign({ sub: user._id.toString(), role: user.role, email: user.email });
  }
}
