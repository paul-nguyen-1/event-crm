import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { RemindersService } from './reminders.service';

/**
 * Unauthenticated by design — reached from a link in an email, not an
 * in-app session. Deliberately a separate controller (rather than a route
 * on RemindersController) so it never inherits that controller's
 * class-level JwtAuthGuard.
 */
@Controller('reminders')
export class RemindersPublicController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('unsubscribe/:token')
  async unsubscribe(@Param('token') token: string, @Res() res: Response) {
    await this.remindersService.unsubscribeByToken(token);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/unsubscribed`);
  }
}
