import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EventType } from '../../../generated/prisma/enums';

export class CreateEventDto {
  @IsString()
  contactId!: string;

  @IsEnum(EventType)
  type!: EventType;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;
}
