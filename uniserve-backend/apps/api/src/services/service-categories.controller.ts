import { Controller, Get } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('service-categories')
export class ServiceCategoriesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  listTree() {
    return this.servicesService.listCategoryTree();
  }
}
