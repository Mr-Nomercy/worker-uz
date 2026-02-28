import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsObject, IsBoolean, IsUUID, IsDate, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanySize, EmployerStatus, BranchStatus, RecruiterStatus } from '@prisma/client';

export class UpdateEmployerProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(255)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @Max(255)
  branchName: string;

  @ApiProperty()
  @IsObject()
  address: Record<string, any>;

  @ApiProperty()
  @IsString()
  @Max(100)
  city: string;

  @ApiProperty()
  @IsString()
  @Max(100)
  state: string;

  @ApiProperty()
  @IsString()
  @Max(100)
  country: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHq?: boolean;
}

export class UpdateBranchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(255)
  branchName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(20)
  phone?: string;

  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHq?: boolean;
}

export class ListBranchesDto {
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

  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}

export class CreateRecruiterDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsString()
  @Max(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(20)
  phone?: string;
}

export class UpdateRecruiterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(100)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Max(20)
  phone?: string;

  @ApiPropertyOptional({ enum: RecruiterStatus })
  @IsOptional()
  @IsEnum(RecruiterStatus)
  status?: RecruiterStatus;
}

export class ListRecruitersDto {
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

  @ApiPropertyOptional({ enum: RecruiterStatus })
  @IsOptional()
  @IsEnum(RecruiterStatus)
  status?: RecruiterStatus;
}
