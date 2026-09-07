import { IsEnum } from 'class-validator';
import { GiftStatus } from '../../../generated/prisma/enums';

export class UpdateGiftDto {
  @IsEnum(GiftStatus)
  status!: GiftStatus;
}
