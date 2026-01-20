import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('categories')
  categories() {
    return this.jobsService.listCategories();
  }

  @Get()
  list(@Query() query: any) {
    return this.jobsService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.jobsService.byId(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any, @Req() req: Request) {
    return this.jobsService.create((req.user as any)._id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/contact')
  contact(@Param('id') id: string, @Body('message') message: string, @Req() req: Request) {
    return this.jobsService.contact(id, (req.user as any)._id, message);
  }
}
