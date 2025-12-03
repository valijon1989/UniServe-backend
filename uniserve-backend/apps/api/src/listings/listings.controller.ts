import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Post()
  create(@Body() body: any, @Req() req: Request) {
    return this.listingsService.create((req.user as any)._id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Get('my')
  my(@Req() req: Request) {
    return this.listingsService.my((req.user as any)._id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    return this.listingsService.update((req.user as any)._id, id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Put(':id/mark-sold')
  markSold(@Param('id') id: string, @Req() req: Request) {
    return this.listingsService.markSold((req.user as any)._id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.listingsService.delete((req.user as any)._id, id);
  }

  @Get()
  list(@Query() query: any) {
    const filters: any = {};
    if (query.agent) filters.agent = query.agent;
    if (query.status) filters.status = query.status;
    return this.listingsService.list(filters);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.listingsService.byId(id);
  }
}
