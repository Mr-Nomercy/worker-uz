import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class VerifyWorkerDto {
  @ApiProperty()
  @IsString()
  pinfl: string;

  @ApiProperty()
  @IsString()
  documentNumber: string;

  @ApiProperty()
  @IsString()
  documentType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}

export class VerifyEmployerDto {
  @ApiProperty()
  @IsString()
  businessRegNo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;
}

export class VerifyEducationDto {
  @ApiProperty()
  @IsString()
  pinfl: string;

  @ApiProperty()
  @IsString()
  institutionCode: string;

  @ApiProperty()
  @IsString()
  diplomaNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graduationYear?: string;
}

export class GetCacheStatsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiType?: string;
}

export class ClearCacheDto {
  @ApiProperty()
  @IsString()
  apiType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
