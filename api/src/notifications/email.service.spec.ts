import { Resend } from 'resend';
import { EmailService } from './email.service';

jest.mock('resend');

describe('EmailService.sendReminderEmail', () => {
  let service: EmailService;
  let send: jest.Mock;

  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'reminders@example.com',
    };

    send = jest.fn();
    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: { send },
    }));

    service = new EmailService();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sends via Resend using the configured from address and returns true on success', async () => {
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    const result = await service.sendReminderEmail({
      to: 'user@example.com',
      subject: "Sarah's birthday is coming up",
      body: "Sarah's birthday is on 2026-08-25.",
      deepLink: '/contacts/c1',
    });

    expect(result).toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'reminders@example.com',
        to: 'user@example.com',
        subject: "Sarah's birthday is coming up",
      }),
    );
  });

  it('returns false, without throwing, when Resend rejects the send', async () => {
    send.mockResolvedValue({
      data: null,
      error: { message: 'invalid_from_address', statusCode: 422 },
    });

    const result = await service.sendReminderEmail({
      to: 'user@example.com',
      subject: 'subject',
      body: 'body',
      deepLink: '/contacts/c1',
    });

    expect(result).toBe(false);
  });

  it('does not construct the Resend client until a send is actually attempted', () => {
    expect(Resend).not.toHaveBeenCalled();
  });
});
