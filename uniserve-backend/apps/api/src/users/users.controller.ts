import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.follow((req.user as any)._id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/unfollow')
  unfollow(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.unfollow((req.user as any)._id, id);
  }

  @Get(':id/followers')
  followers(@Param('id') id: string) {
    return this.usersService.listFollowers(id);
  }

  @Get(':id/following')
  following(@Param('id') id: string) {
    return this.usersService.listFollowing(id);
  }
}
