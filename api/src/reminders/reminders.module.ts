import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OutboxModule } from '../outbox/outbox.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersPublicController } from './reminders-public.controller';
import { RemindersJobService } from './reminders-job.service';

@Module({
  imports: [
    OutboxModule,
    NotificationsModule,
    SuggestionsModule,
    JwtModule.register({}),
  ],
  controllers: [RemindersController, RemindersPublicController],
  providers: [RemindersService, RemindersJobService],
  exports: [RemindersService],
})
export class RemindersModule {}
