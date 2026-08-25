import { Module } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';

@Module({
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
