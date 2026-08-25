import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

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
}
