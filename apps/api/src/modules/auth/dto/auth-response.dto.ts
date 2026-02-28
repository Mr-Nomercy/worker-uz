import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  tokenType: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  familyId: string;

  @ApiProperty()
  user: UserResponseDto;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiPropertyOptional()
  verifiedAt?: Date;
}

export class TokenRefreshResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  tokenType: string;
}

export class LogoutResponseDto {
  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  sessionsTerminated?: number;
}

export class RegisterResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  verificationRequired?: boolean;
}

export class GovVerificationResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  nextSteps?: string;
}
