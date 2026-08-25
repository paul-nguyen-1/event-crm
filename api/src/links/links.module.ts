import { Module } from '@nestjs/common';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';
import { ProductsController } from './products.controller';
import { AffiliateLinkService } from './affiliate-link.service';

@Module({
  controllers: [LinksController, ProductsController],
  providers: [LinksService, AffiliateLinkService],
  exports: [AffiliateLinkService],
})
export class LinksModule {}
