import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface ReminderEmail {
  to: string;
  subject: string;
  body: string;
  deepLink: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend?: Resend;

  // Constructed lazily, not as a field initializer: Resend's constructor
  // throws synchronously if the API key is missing, which would otherwise
  // crash app bootstrap in any environment (CI, local dev) that hasn't
  // configured RESEND_API_KEY yet, even if nothing ever sends an email.
  private client(): Resend {
    if (!this.resend) this.resend = new Resend(process.env.RESEND_API_KEY);
    return this.resend;
  }

  /** Returns whether Resend accepted the send. Never throws. */
  async sendReminderEmail(email: ReminderEmail): Promise<boolean> {
    const { data, error } = await this.client().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email.to,
      subject: email.subject,
      text: `${email.body}\n\n${email.deepLink}`,
    });

    if (error) {
      this.logger.error(
        `Resend rejected reminder email to ${email.to}: ${error.message}`,
      );
      return false;
    }

    this.logger.log(`Reminder email ${data.id} sent to ${email.to}`);
    return true;
  }
}
