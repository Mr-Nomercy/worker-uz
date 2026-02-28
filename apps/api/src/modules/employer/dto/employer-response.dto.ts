import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanySize, EmployerStatus, BranchStatus, RecruiterStatus } from '@prisma/client';

export class EmployerProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  businessRegNo: string;

  @ApiProperty()
  taxId: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  legalName: string;

  @ApiProperty()
  industry: string;

  @ApiProperty({ enum: CompanySize })
  companySize: CompanySize;

  @ApiPropertyOptional()
  website?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  headquartersAddress: any;

  @ApiPropertyOptional()
  verifiedAt?: Date;

  @ApiProperty({ enum: EmployerStatus })
  status: EmployerStatus;

  @ApiProperty()
  maxVacancies: number;

  @ApiProperty()
  maxRecruiters: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmployerProfileUpdateResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  website?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  updatedAt: Date;
}

export class BranchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employerId: string;

  @ApiProperty()
  branchName: string;

  @ApiProperty()
  address: any;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  country: string;

  @ApiPropertyOptional()
  postalCode?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  isHq: boolean;

  @ApiProperty({ enum: BranchStatus })
  status: BranchStatus;

  @ApiProperty()
  createdAt: Date;
}

export class BranchListResponseDto {
  @ApiProperty()
  items: BranchResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class RecruiterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employerId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  designation?: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty({ enum: RecruiterStatus })
  status: RecruiterStatus;

  @ApiProperty()
  createdAt: Date;
}

export class RecruiterListResponseDto {
  @ApiProperty()
  items: RecruiterResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class ComplianceCheckResponseDto {
  @ApiProperty()
  isCompliant: boolean;

  @ApiPropertyOptional()
  reason?: string;
}
