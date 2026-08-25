import { Module } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { EmailService } from './email.service';
import { NotificationsReceiptsConsumerService } from './notifications-receipts-consumer.service';

@Module({
  providers: [
    NotificationPreferencesService,
    EmailService,
    NotificationsReceiptsConsumerService,
  ],
  exports: [NotificationPreferencesService, EmailService],
})
export class NotificationsModule {}
