import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { GiftStatus } from '../../../generated/prisma/enums';

export class CreateGiftDto {
  @IsString()
  contactId!: string;

  @IsString()
  @MinLength(1)
  occasion!: string;

  @IsDateString()
  giftDate!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;

  @IsOptional()
  @IsEnum(GiftStatus)
  status?: GiftStatus;
}
