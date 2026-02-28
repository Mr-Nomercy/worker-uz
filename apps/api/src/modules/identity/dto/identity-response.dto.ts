import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

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

  @ApiPropertyOptional()
  lastLoginAt?: Date;

  @ApiPropertyOptional()
  failedLoginAttempts?: number;

  @ApiPropertyOptional()
  lockedUntil?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserListResponseDto {
  @ApiProperty()
  users: UserResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  familyId: string;

  @ApiPropertyOptional()
  deviceFingerprint?: string;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiProperty()
  isRevoked: boolean;

  @ApiPropertyOptional()
  revokedAt?: Date;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  createdAt: Date;
}

export class SessionListResponseDto {
  @ApiProperty()
  sessions: SessionResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  level: number;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  permissions?: PermissionResponseDto[];
}

export class RoleListResponseDto {
  @ApiProperty()
  roles: RoleResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class PermissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  resource: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  createdAt: Date;
}

export class PermissionListResponseDto {
  @ApiProperty()
  permissions: PermissionResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class UpdateUserStatusResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty()
  updatedAt: Date;
}

export class RevokeSessionResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  sessionId: string;
}

export class RevokeAllSessionsResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  sessionsRevoked: number;
}

export class DeleteRoleResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  roleId: string;
}
