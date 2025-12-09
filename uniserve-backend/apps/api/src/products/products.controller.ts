import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: any) {
    return this.productsService.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.productsService.detail(id);
  }

  @Post(':id/view')
  addView(@Param('id') id: string) {
    return this.productsService.incrementStat(id, 'views');
  }

  @Post(':id/like')
  addLike(@Param('id') id: string) {
    return this.productsService.incrementStat(id, 'likes');
  }

  @Post(':id/purchase')
  addPurchase(@Param('id') id: string) {
    return this.productsService.incrementStat(id, 'purchases');
  }
}
