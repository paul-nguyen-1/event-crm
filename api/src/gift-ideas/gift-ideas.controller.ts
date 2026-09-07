import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/authenticated-request';
import { GiftIdeasService } from './gift-ideas.service';
import { CreateGiftIdeaDto } from './dto/create-gift-idea.dto';

@Controller('gift-ideas')
@UseGuards(JwtAuthGuard)
export class GiftIdeasController {
  constructor(private readonly giftIdeasService: GiftIdeasService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGiftIdeaDto,
  ) {
    return this.giftIdeasService.create(user.userId, dto);
  }

  @Get()
  findAllForContact(
    @CurrentUser() user: AuthenticatedUser,
    @Query('contactId') contactId: string,
  ) {
    return this.giftIdeasService.findAllForContact(contactId, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.giftIdeasService.remove(id, user.userId);
  }
}
