import { Controller, Get, Query } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('feed')
  async feed(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    const items = await this.postsService.getFeed(parsed || 50);
    return { items };
  }
}
