import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/authenticated-request';
import { LinksService } from './links.service';

@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get(':productId/click')
  click(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('contactId') contactId?: string,
  ) {
    return this.linksService.clickAndResolve(user.userId, productId, contactId);
  }
}
