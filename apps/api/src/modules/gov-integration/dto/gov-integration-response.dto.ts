import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GovApiLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  apiType: string;

  @ApiProperty()
  requestUrl: string;

  @ApiProperty()
  requestMethod: string;

  @ApiPropertyOptional()
  responseStatusCode?: number;

  @ApiPropertyOptional()
  responseTimeMs?: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class CacheStatsResponseDto {
  @ApiProperty()
  apiType: string;

  @ApiProperty()
  hitCount: number;

  @ApiProperty()
  missCount: number;

  @ApiProperty()
  totalEntries: number;

  @ApiProperty()
  oldestEntry: Date;
}

export class VerificationResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  verified: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  data?: any;

  @ApiPropertyOptional()
  transactionId?: string;
}

export class WorkerVerificationResponseDto extends VerificationResponseDto {
  @ApiPropertyOptional()
  workerId?: string;

  @ApiPropertyOptional()
  fullName?: string;

  @ApiPropertyOptional()
  birthDate?: string;

  @ApiPropertyOptional()
  address?: string;
}

export class EmployerVerificationResponseDto extends VerificationResponseDto {
  @ApiPropertyOptional()
  employerId?: string;

  @ApiPropertyOptional()
  companyName?: string;

  @ApiPropertyOptional()
  registrationDate?: string;

  @ApiPropertyOptional()
  status?: string;
}

export class EducationVerificationResponseDto extends VerificationResponseDto {
  @ApiPropertyOptional()
  institutionName?: string;

  @ApiPropertyOptional()
  degree?: string;

  @ApiPropertyOptional()
  graduationYear?: string;
}
