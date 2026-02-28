import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsBoolean, IsUUID, IsDateString, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { JobType, RemoteType, EducationLevel, VacancyStatus } from '@prisma/client';

export const ProficiencyLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  EXPERT: 'EXPERT',
} as const;

export type ProficiencyLevel = typeof ProficiencyLevel[keyof typeof ProficiencyLevel];

export class VacancySkillDto {
  @ApiProperty()
  @IsString()
  @Max(50)
  skillCode: string;

  @ApiProperty()
  @IsString()
  @Max(255)
  skillName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ enum: ProficiencyLevel })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  minProficiency?: ProficiencyLevel;
}

export class VacancyRequirementDto {
  @ApiProperty()
  @IsString()
  @Max(50)
  requirementType: string;

  @ApiProperty()
  @IsString()
  requirementText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

export class CreateVacancyDto {
  @ApiProperty()
  @IsString()
  @Max(255)
  jobTitle: string;

  @ApiProperty()
  @IsString()
  @Max(50)
  jobCode: string;

  @ApiProperty()
  @IsString()
  jobDescription: string;

  @ApiProperty({ enum: JobType })
  @IsEnum(JobType)
  jobType: JobType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  salaryMin: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  salaryMax: number;

  @ApiProperty()
  @IsString()
  @Max(3)
  salaryCurrency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  salaryIsNegotiable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  locationAddress?: Record<string, any>;

  @ApiProperty()
  @IsString()
  @Max(100)
  locationCity: string;

  @ApiProperty()
  @IsString()
  @Max(100)
  locationState: string;

  @ApiProperty()
  @IsString()
  @Max(100)
  locationCountry: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @ApiPropertyOptional({ enum: RemoteType })
  @IsOptional()
  @IsEnum(RemoteType)
  remoteType?: RemoteType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceMinYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceMaxYears?: number;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationMinLevel?: EducationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  vacancyCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ type: [VacancySkillDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacancySkillDto)
  skills?: VacancySkillDto[];

  @ApiPropertyOptional({ type: [VacancyRequirementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacancyRequirementDto)
  requirements?: VacancyRequirementDto[];
}

export class UpdateVacancyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(255)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  salaryIsNegotiable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  locationAddress?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  locationCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  locationState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @ApiPropertyOptional({ enum: RemoteType })
  @IsOptional()
  @IsEnum(RemoteType)
  remoteType?: RemoteType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceMinYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceMaxYears?: number;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationMinLevel?: EducationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  vacancyCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ type: [VacancySkillDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacancySkillDto)
  skills?: VacancySkillDto[];

  @ApiPropertyOptional({ type: [VacancyRequirementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacancyRequirementDto)
  requirements?: VacancyRequirementDto[];
}

export class ListVacanciesDto {
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

  @ApiPropertyOptional({ enum: VacancyStatus })
  @IsOptional()
  @IsEnum(VacancyStatus)
  status?: VacancyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  locationCity?: string;
}

export class PublishVacancyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(500)
  changeSummary?: string;
}
