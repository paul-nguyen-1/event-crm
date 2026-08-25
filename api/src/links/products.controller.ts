import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LinksService } from './links.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly linksService: LinksService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linksService.findProduct(id);
  }
}
