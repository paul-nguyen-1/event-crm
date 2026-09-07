import { Module } from '@nestjs/common';
import { GiftIdeasService } from './gift-ideas.service';
import { GiftIdeasController } from './gift-ideas.controller';

@Module({
  controllers: [GiftIdeasController],
  providers: [GiftIdeasService],
})
export class GiftIdeasModule {}
