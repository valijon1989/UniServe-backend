import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('feed')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Post('posts')
  create(@Body() body: any, @Req() req: Request) {
    return this.feedService.createPost((req.user as any)._id, body);
  }

  @Get()
  feed(@Req() req: Request) {
    return this.feedService.feedFor((req.user as any)._id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.feedService.byId(id);
  }

  @Post(':id/like')
  like(@Param('id') id: string, @Req() req: Request) {
    return this.feedService.like(id, (req.user as any)._id);
  }

  @Post(':id/unlike')
  unlike(@Param('id') id: string, @Req() req: Request) {
    return this.feedService.unlike(id, (req.user as any)._id);
  }

  @Post(':id/comment')
  comment(@Param('id') id: string, @Body('text') text: string, @Req() req: Request) {
    return this.feedService.comment(id, (req.user as any)._id, text);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string) {
    return this.feedService.comments(id);
  }

  @Roles('ADMIN')
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.feedService.delete(id, (req.user as any)._id, true);
  }
}
