import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vacancyId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  cvSnapshotId: string;

  @ApiProperty()
  currentVersion: number;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiPropertyOptional()
  employerNotes?: string;

  @ApiProperty()
  appliedAt: Date;

  @ApiPropertyOptional()
  reviewedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ApplicationListResponseDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  items: ApplicationResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class ApplyResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  application: ApplicationResponseDto;
}

export class WithdrawResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  application: ApplicationResponseDto;
}

export class StatusUpdateResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  application: ApplicationResponseDto;
}

export class ApplicationDetailResponseDto {
  @ApiProperty()
  application: ApplicationResponseDto;

  @ApiPropertyOptional()
  vacancy?: any;

  @ApiPropertyOptional()
  cvSnapshot?: any;
}
