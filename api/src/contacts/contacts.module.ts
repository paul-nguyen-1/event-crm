import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';

@Module({
  imports: [OutboxModule, SuggestionsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
