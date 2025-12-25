import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get(':providerId/services')
  listProviderServices(@Param('providerId') providerId: string, @Query() query: any) {
    return this.servicesService.listByProvider(providerId, query);
  }
}
