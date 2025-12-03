import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    const emailExists = await this.users.emailExists(email);
    if (emailExists) {
      throw new BadRequestException('Email already registered');
    }
    const usernameExists = await this.users.usernameExists(username);
    if (usernameExists) {
      throw new BadRequestException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.createUser({
      email,
      username,
      name: dto.name,
      passwordHash,
      role: 'USER',
    });

    const token = this.sign(user.id, user.role);
    return { token, user: this.sanitize(user) };
  }

  async login(dto: LoginDto) {
    const identifier =
      dto.identifier?.trim().toLowerCase() ||
      dto.email?.trim().toLowerCase() ||
      dto.username?.trim().toLowerCase();
    if (!identifier) {
      throw new BadRequestException('email/username is required');
    }

    const user = await this.users.findByEmailOrUsername(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.sign(user.id, user.role);
    return { token, user: this.sanitize(user) };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    return user ? this.sanitize(user) : null;
  }

  private sign(sub: string, role: string) {
    const payload: JwtPayload = { sub, role: role as any };
    const secret = this.config.get<string>('JWT_SECRET');
    return this.jwt.sign(payload, { secret, expiresIn: '7d' });
  }

  private sanitize(user: any) {
    const obj = user?.toObject ? user.toObject() : user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, __v, ...rest } = obj || {};
    return rest;
  }
}
