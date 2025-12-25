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
    return this.servicesService.listFeed(query);
  }

  @Get('categories')
  categories() {
    return this.servicesService.listCategoryTree();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.servicesService.byId(id);
  }

  @Post(':id/view')
  addView(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.trackView(id, req.ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  addLike(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.likeService(id, (req.user as any)._id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  removeLike(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.unlikeService(id, (req.user as any)._id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/save')
  addSave(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.saveService(id, (req.user as any)._id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/save')
  removeSave(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.unsaveService(id, (req.user as any)._id);
  }

  @Post(':id/share')
  addShare(@Param('id') id: string) {
    return this.servicesService.incrementStat(id, 'shares');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/use')
  markUsed(@Param('id') id: string, @Req() req: Request) {
    return this.servicesService.markUsage(id, (req.user as any)._id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/rate')
  rate(@Param('id') id: string, @Req() req: Request, @Body('rating') rating: number) {
    return this.servicesService.rateService(id, (req.user as any)._id, rating);
  }
}
