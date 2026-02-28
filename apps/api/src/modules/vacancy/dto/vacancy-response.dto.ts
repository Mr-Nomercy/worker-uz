import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, RemoteType, EducationLevel, VacancyStatus, ComplianceStatus } from '@prisma/client';

export class VacancyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employerId: string;

  @ApiPropertyOptional()
  branchId?: string;

  @ApiProperty()
  jobTitle: string;

  @ApiProperty()
  jobCode: string;

  @ApiProperty()
  jobDescription: string;

  @ApiProperty({ enum: JobType })
  jobType: JobType;

  @ApiProperty()
  salaryMin: number;

  @ApiProperty()
  salaryMax: number;

  @ApiProperty()
  salaryCurrency: string;

  @ApiProperty()
  salaryIsNegotiable: boolean;

  @ApiPropertyOptional()
  locationAddress?: any;

  @ApiProperty()
  locationCity: string;

  @ApiProperty()
  locationState: string;

  @ApiProperty()
  locationCountry: string;

  @ApiProperty()
  isRemote: boolean;

  @ApiPropertyOptional({ enum: RemoteType })
  remoteType?: RemoteType;

  @ApiPropertyOptional()
  experienceMinYears?: number;

  @ApiPropertyOptional()
  experienceMaxYears?: number;

  @ApiPropertyOptional({ enum: EducationLevel })
  educationMinLevel?: EducationLevel;

  @ApiProperty()
  vacancyCount: number;

  @ApiProperty()
  currentVersion: number;

  @ApiProperty({ enum: VacancyStatus })
  status: VacancyStatus;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiPropertyOptional()
  publishedAt?: Date;

  @ApiPropertyOptional()
  closedAt?: Date;

  @ApiProperty({ enum: ComplianceStatus })
  complianceStatus: ComplianceStatus;

  @ApiPropertyOptional()
  complianceNotes?: string;

  @ApiProperty()
  viewCount: number;

  @ApiProperty()
  applicationCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class VacancyListResponseDto {
  @ApiProperty({ type: [VacancyResponseDto] })
  items: VacancyResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class VacancyVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vacancyId: string;

  @ApiProperty()
  versionNumber: number;

  @ApiProperty()
  snapshotData: any;

  @ApiPropertyOptional()
  changeSummary?: string;

  @ApiProperty()
  isCurrent: boolean;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;
}

export class PublishResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  vacancy: VacancyResponseDto;

  @ApiProperty()
  versionNumber: number;
}

export class CloseResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  vacancy: VacancyResponseDto;
}
