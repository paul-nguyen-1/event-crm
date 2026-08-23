import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { ReminderChannel } from '../../../generated/prisma/enums';

export class CreateReminderDto {
  @IsString()
  eventId!: string;

  @IsInt()
  @Min(0)
  leadTimeDays!: number;

  @IsEnum(ReminderChannel)
  channel!: ReminderChannel;
}
