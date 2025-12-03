import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Post()
  create(@Body() body: any, @Req() req: Request) {
    return this.servicesService.createService((req.user as any)._id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Get('my')
  my(@Req() req: Request) {
    return this.servicesService.myServices((req.user as any)._id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    return this.servicesService.updateService((req.user as any)._id, id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.deleteService((req.user as any)._id, id);
  }

  @Get()
  list(@Query() query: any) {
    const filters: any = {};
    if (query.category) filters.category = query.category;
    if (query.type) filters.type = query.type;
    if (query.location) filters.location = query.location;
    return this.servicesService.listPublic(filters);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.servicesService.byId(id);
  }
}
