import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursStartHour?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursEndHour?: number | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;
}
