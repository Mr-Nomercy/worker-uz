import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, GovVerifyStatus, UserStatus, JobType, ProficiencyLevel } from '@prisma/client';

export class WorkerProfileResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  nationalId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Gender })
  gender: Gender;

  @ApiProperty()
  permanentAddress: any;

  @ApiPropertyOptional()
  currentAddress?: any;

  @ApiPropertyOptional()
  profilePhotoUrl?: string;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ enum: GovVerifyStatus })
  govVerifyStatus: GovVerifyStatus;

  @ApiPropertyOptional()
  govVerifyAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ContactResponseDto {
  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;
}

export class WorkerEducationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  institutionName: string;

  @ApiPropertyOptional()
  institutionCode?: string;

  @ApiProperty()
  degree: string;

  @ApiProperty()
  fieldOfStudy: string;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional()
  endDate?: Date;

  @ApiPropertyOptional()
  gradeGpa?: number;

  @ApiPropertyOptional()
  gradeScale?: number;

  @ApiPropertyOptional()
  verifiedAt?: Date;

  @ApiProperty()
  sourceSystem: string;

  @ApiProperty()
  createdAt: Date;
}

export class WorkerEducationListResponseDto {
  @ApiProperty()
  items: WorkerEducationResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class WorkerExperienceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  employerName: string;

  @ApiPropertyOptional()
  employerRegNo?: string;

  @ApiProperty()
  jobTitle: string;

  @ApiProperty({ enum: JobType })
  jobType: JobType;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional()
  endDate?: Date;

  @ApiPropertyOptional()
  salary?: number;

  @ApiPropertyOptional()
  currency?: string;

  @ApiPropertyOptional()
  reasonForLeaving?: string;

  @ApiPropertyOptional()
  verifiedAt?: Date;

  @ApiProperty()
  sourceSystem: string;

  @ApiProperty()
  createdAt: Date;
}

export class WorkerExperienceListResponseDto {
  @ApiProperty()
  items: WorkerExperienceResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class WorkerSkillResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  skillCode: string;

  @ApiProperty()
  skillName: string;

  @ApiProperty({ enum: ProficiencyLevel })
  proficiencyLevel: ProficiencyLevel;

  @ApiProperty()
  yearsExperience: number;

  @ApiPropertyOptional()
  verifiedAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class WorkerSkillListResponseDto {
  @ApiProperty()
  items: WorkerSkillResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class CvSnapshotResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  snapshotVersion: number;

  @ApiProperty()
  snapshotData: any;

  @ApiProperty()
  sha256Hash: string;

  @ApiPropertyOptional()
  previousHash?: string;

  @ApiProperty({ enum: GovVerifyStatus })
  govVerifyStatus: GovVerifyStatus;

  @ApiPropertyOptional()
  govVerifyAt?: Date;

  @ApiProperty()
  sourceApi: string;

  @ApiProperty()
  isCurrent: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class CvSnapshotListResponseDto {
  @ApiProperty()
  items: CvSnapshotResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class GenerateSnapshotResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  snapshot: CvSnapshotResponseDto;
}

export class WorkerCvResponseDto {
  @ApiProperty()
  workerId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  profilePhotoUrl?: string;

  @ApiProperty()
  education: WorkerEducationResponseDto[];

  @ApiProperty()
  experience: WorkerExperienceResponseDto[];

  @ApiProperty()
  skills: WorkerSkillResponseDto[];

  @ApiProperty()
  snapshotVersion: number;

  @ApiProperty()
  snapshotHash: string;

  @ApiProperty()
  verifiedAt?: Date;
}
