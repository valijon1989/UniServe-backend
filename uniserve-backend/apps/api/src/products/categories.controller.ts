import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list() {
    return this.productsService.listCategories();
  }

  @Get(':id/subcategories')
  subCategories(@Param('id') id: string) {
    return this.productsService.listSubCategories(id);
  }
}
