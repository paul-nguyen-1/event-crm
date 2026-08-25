import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface ReminderEmailSuggestion {
  name: string;
  basePrice: string;
  imageUrl: string | null;
}

export interface ReminderEmail {
  to: string;
  subject: string;
  body: string;
  deepLink: string;
  // Everything below is optional so callers that only have the plain
  // title/body (or tests) keep working — the HTML upgrades opportunistically
  // when the richer context is available.
  contactName?: string;
  occasionLabel?: string;
  occasionDateLabel?: string;
  daysUntil?: number;
  description?: string;
  suggestions?: ReminderEmailSuggestion[];
  seeAllUrl?: string;
  changeTimingUrl?: string;
  unsubscribeUrl?: string;
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
      html: buildHtml(email),
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

/** Inline-styled by necessity: email clients don't load external stylesheets. */
function buildHtml(email: ReminderEmail): string {
  const heading =
    email.contactName && email.occasionLabel && email.occasionDateLabel
      ? `${email.contactName}'s ${email.occasionLabel.toLowerCase()} is on ${email.occasionDateLabel}`
      : email.subject;

  const daysUntilBadge =
    email.daysUntil != null
      ? `<p style="margin:0 0 8px;font:600 11px/1 system-ui,sans-serif;letter-spacing:0.1em;color:#64748b;text-transform:uppercase;">In ${email.daysUntil} day${email.daysUntil === 1 ? '' : 's'}</p>`
      : '';

  const description = email.description ?? email.body;

  const suggestionsHtml =
    email.suggestions && email.suggestions.length > 0
      ? `<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;">
          ${email.suggestions
            .map(
              (s) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font:14px system-ui,sans-serif;color:#0f172a;">${escapeHtml(s.name)}</td>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font:14px system-ui,sans-serif;color:#0f172a;text-align:right;">$${escapeHtml(s.basePrice)}</td>
            </tr>`,
            )
            .join('')}
        </table>`
      : '';

  const seeAllButton = email.seeAllUrl
    ? `<a href="${email.seeAllUrl}" style="display:inline-block;margin-top:4px;padding:10px 18px;background:#5b7ca3;color:#ffffff;font:600 14px system-ui,sans-serif;text-decoration:none;border-radius:6px;">See all suggestions</a>`
    : '';

  const footerLinks = [
    email.changeTimingUrl
      ? `<a href="${email.changeTimingUrl}" style="color:#64748b;">Change reminder timing</a>`
      : null,
    email.unsubscribeUrl
      ? `<a href="${email.unsubscribeUrl}" style="color:#64748b;">Unsubscribe from this date</a>`
      : null,
  ].filter(Boolean);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">
      <tr><td>
        <p style="margin:0 0 16px;font:700 15px/1 system-ui,sans-serif;letter-spacing:0.02em;color:#0f172a;">OCCASION</p>
        ${daysUntilBadge}
        <h1 style="margin:0 0 12px;font:700 22px/1.3 system-ui,sans-serif;color:#0f172a;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 4px;font:14px/1.5 system-ui,sans-serif;color:#334155;">${escapeHtml(description)}</p>
        ${suggestionsHtml}
        ${seeAllButton}
        <p style="margin:24px 0 4px;font:12px/1.6 system-ui,sans-serif;color:#94a3b8;">Product links are affiliate links.</p>
        <p style="margin:0;font:12px/1.6 system-ui,sans-serif;">${footerLinks.join(' &middot; ')}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
