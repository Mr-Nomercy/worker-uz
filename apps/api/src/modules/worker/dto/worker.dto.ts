import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsEnum, IsUUID, IsNumber, Min, Max, IsDateString, IsArray, IsBoolean, IsObject, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, JobType, ProficiencyLevel } from '@prisma/client';

export class UpdateContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Min(10)
  @Max(20)
  phone?: string;
}

export class CreateEducationDto {
  @ApiProperty()
  @IsString()
  institutionName: string;

  @ApiProperty()
  @IsString()
  institutionCode: string;

  @ApiProperty()
  @IsString()
  degree: string;

  @ApiProperty()
  @IsString()
  fieldOfStudy: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  gradeGpa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  gradeScale?: number;
}

export class UpdateEducationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institutionCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  gradeGpa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  gradeScale?: number;
}

export class CreateExperienceDto {
  @ApiProperty()
  @IsString()
  employerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employerRegNo?: string;

  @ApiProperty()
  @IsString()
  jobTitle: string;

  @ApiProperty({ enum: JobType })
  @IsEnum(JobType)
  jobType: JobType;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonForLeaving?: string;
}

export class UpdateExperienceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employerRegNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ enum: JobType })
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonForLeaving?: string;
}

export class CreateSkillDto {
  @ApiProperty()
  @IsString()
  skillCode: string;

  @ApiProperty()
  @IsString()
  skillName: string;

  @ApiProperty({ enum: ProficiencyLevel })
  @IsEnum(ProficiencyLevel)
  proficiencyLevel: ProficiencyLevel;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(50)
  yearsExperience: number;
}

export class UpdateSkillDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skillCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skillName?: string;

  @ApiPropertyOptional({ enum: ProficiencyLevel })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  proficiencyLevel?: ProficiencyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  yearsExperience?: number;
}

export class GenerateSnapshotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceNew?: boolean;
}

export class ListEducationDto {
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
}

export class ListExperienceDto {
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
}

export class ListSkillsDto {
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
}

export class ViewWorkerCvDto {
  @ApiProperty()
  @IsUUID()
  workerId: string;
}
