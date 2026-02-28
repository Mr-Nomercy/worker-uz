import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsBoolean, IsUUID, IsDateString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { InterviewMode } from '@prisma/client';

export class ScheduleInterviewDto {
  @ApiProperty()
  @IsUUID()
  applicationId: string;

  @ApiProperty()
  @IsDateString()
  scheduledDatetime: string;

  @ApiProperty()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes: number;

  @ApiProperty({ enum: InterviewMode })
  @IsEnum(InterviewMode)
  mode: InterviewMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meetingLink?: string;
}

export class ConfirmInterviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectInterviewDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class CancelInterviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteInterviewDto {
  @ApiProperty()
  @IsEnum(['HIRED', 'REJECTED', 'PENDING_FURTHER_REVIEW'])
  outcome: 'HIRED' | 'REJECTED' | 'PENDING_FURTHER_REVIEW';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalFeedback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hiredSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hiredStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  contractDetails?: Record<string, any>;
}

export class ListInterviewsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: ['INVITED', 'ACCEPTED', 'DECLINED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] })
  @IsOptional()
  @IsEnum(['INVITED', 'ACCEPTED', 'DECLINED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: string;
}

export class ListVacancyInterviewsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: ['INVITED', 'ACCEPTED', 'DECLINED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] })
  @IsOptional()
  @IsEnum(['INVITED', 'ACCEPTED', 'DECLINED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
