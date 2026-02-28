import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewStatus, InterviewMode } from '@prisma/client';

export class InterviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  vacancyId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  employerId: string;

  @ApiPropertyOptional()
  recruiterId?: string;

  @ApiProperty({ enum: InterviewStatus })
  status: InterviewStatus;

  @ApiProperty()
  invitedAt: Date;

  @ApiPropertyOptional()
  respondedAt?: Date;

  @ApiPropertyOptional()
  scheduledAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional({ enum: InterviewMode })
  mode?: InterviewMode;

  @ApiPropertyOptional()
  location?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class InterviewScheduleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  interviewId: string;

  @ApiProperty()
  scheduledDatetime: Date;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ enum: InterviewMode })
  mode: InterviewMode;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  meetingLink?: string;

  @ApiProperty()
  employerConfirmed: boolean;

  @ApiPropertyOptional()
  employerConfirmedAt?: Date;

  @ApiProperty()
  workerConfirmed: boolean;

  @ApiPropertyOptional()
  workerConfirmedAt?: Date;
}

export class InterviewListResponseDto {
  @ApiProperty({ type: [InterviewResponseDto] })
  items: InterviewResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class ScheduleResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  interview: InterviewResponseDto;
}

export class ConfirmResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  interview: InterviewResponseDto;
}

export class RejectResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  interview: InterviewResponseDto;
}

export class CancelResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  interview: InterviewResponseDto;
}

export class CompleteResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  interview: InterviewResponseDto;
}

export class InterviewDetailResponseDto {
  @ApiProperty()
  interview: InterviewResponseDto;

  @ApiPropertyOptional()
  schedule?: InterviewScheduleResponseDto;

  @ApiPropertyOptional()
  application?: any;

  @ApiPropertyOptional()
  vacancy?: any;
}
