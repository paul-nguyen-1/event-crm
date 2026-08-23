import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersJobService } from './reminders-job.service';

@Module({
  imports: [OutboxModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersJobService],
  exports: [RemindersService],
})
export class RemindersModule {}
