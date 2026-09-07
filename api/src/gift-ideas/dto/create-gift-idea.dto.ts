import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGiftIdeaDto {
  @IsString()
  contactId!: string;

  @IsUrl()
  url!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
