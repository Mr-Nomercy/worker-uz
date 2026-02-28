import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../auth/audit.service';
import { IdentityRepository } from './identity.repository';
import {
  ListUsersDto,
  UpdateUserStatusDto,
  SoftDeleteUserDto,
  ListSessionsDto,
  RevokeSessionDto,
  RevokeAllSessionsDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  ListRolesDto,
  ListPermissionsDto,
} from './dto/identity.dto';
import { UserStatus, UserRole } from '@prisma/client';

const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'WORKER', 'EMPLOYER'];

@Injectable()
export class IdentityService {
  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(dto: ListUsersDto, adminId: string, adminRole: string, ipAddress: string) {
    this.validateAdminAccess(adminRole);

    const result = await this.identityRepository.listUsers({
      page: Math.max(1, dto.page || 1),
      pageSize: Math.min(dto.pageSize || 20, 100),
      status: dto.status,
      role: dto.role,
      search: dto.search,
      createdAfter: dto.createdAfter ? new Date(dto.createdAfter) : undefined,
      createdBefore: dto.createdBefore ? new Date(dto.createdBefore) : undefined,
    });

    await this.auditService.log('USER_LISTED', {
      userId: adminId,
      ipAddress,
      details: { filters: dto, resultCount: result.totalCount },
    });

    return {
      users: result.items.map(this.mapUserToResponse),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async getUser(userId: string, adminId: string, adminRole: string, ipAddress: string) {
    this.validateAdminAccess(adminRole);

    const user = await this.identityRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    await this.auditService.log('USER_VIEWED', {
      userId: adminId,
      targetUserId: userId,
      ipAddress,
      details: { action: 'view_user' },
    });

    return this.mapUserToResponse(user);
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateAdminAccess(adminRole);

    if (userId === adminId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_UPDATE_SELF', message: 'Cannot update your own status' },
      });
    }

    const user = await this.identityRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const oldStatus = user.status;

    if (oldStatus === dto.status) {
      return {
        id: user.id,
        status: oldStatus,
        updatedAt: user.updatedAt,
      };
    }

    const updatedUser = await this.identityRepository.atomicStatusUpdateWithSessionRevoke(
      userId,
      dto.status,
      oldStatus,
    );

    await this.auditService.log('USER_STATUS_UPDATED', {
      userId: adminId,
      targetUserId: userId,
      ipAddress,
      details: {
        oldStatus,
        newStatus: dto.status,
        reason: dto.reason,
        diff: { status: { from: oldStatus, to: dto.status } },
      },
    });

    return {
      id: updatedUser.id,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async softDeleteUser(
    userId: string,
    dto: SoftDeleteUserDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateAdminAccess(adminRole);

    if (userId === adminId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own account' },
      });
    }

    const user = await this.identityRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    await this.identityRepository.atomicSoftDeleteWithSessionRevoke(userId);

    await this.auditService.log('USER_SOFT_DELETED', {
      userId: adminId,
      targetUserId: userId,
      ipAddress,
      details: { reason: dto.reason, userData: { email: user.email, role: user.role, status: user.status } },
    });

    return { message: 'User deleted successfully', userId };
  }

  async listSessions(
    userId: string,
    dto: ListSessionsDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateAdminAccess(adminRole);

    const user = await this.identityRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const result = await this.identityRepository.findSessionsByUserId(
      userId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
    );

    await this.auditService.log('SESSIONS_LISTED', {
      userId: adminId,
      targetUserId: userId,
      ipAddress,
    });

    return {
      sessions: result.items.map(this.mapSessionToResponse),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async revokeSession(
    userId: string,
    dto: RevokeSessionDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateAdminAccess(adminRole);

    const session = await this.identityRepository.findSessionById(dto.sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    await this.identityRepository.revokeSession(dto.sessionId);

    await this.auditService.log('SESSION_REVOKED', {
      userId: adminId,
      targetUserId: userId,
      sessionId: dto.sessionId,
      ipAddress,
      details: { reason: dto.reason },
    });

    return { message: 'Session revoked successfully', sessionId: dto.sessionId };
  }

  async revokeAllSessions(
    userId: string,
    dto: RevokeAllSessionsDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateAdminAccess(adminRole);

    const count = await this.identityRepository.revokeAllUserSessions(userId);

    await this.auditService.log('ALL_SESSIONS_REVOKED', {
      userId: adminId,
      targetUserId: userId,
      ipAddress,
      details: { reason: dto.reason, sessionsRevoked: count },
    });

    return { message: 'All sessions revoked successfully', sessionsRevoked: count };
  }

  async createRole(dto: CreateRoleDto, adminId: string, adminRole: string, ipAddress: string) {
    this.validateSuperAdminAccess(adminRole);

    if (dto.name === 'SUPER_ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_CREATE_SUPER_ADMIN', message: 'Cannot create SUPER_ADMIN role' },
      });
    }

    if (adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only SUPER_ADMIN can create roles' },
      });
    }

    const existingRole = await this.identityRepository.findRoleByName(dto.name);
    if (existingRole) {
      throw new BadRequestException({
        success: false,
        error: { code: 'ROLE_EXISTS', message: 'Role already exists' },
      });
    }

    const role = await this.identityRepository.createRole({
      name: dto.name,
      description: dto.description,
      level: dto.level,
    });

    await this.auditService.log('ROLE_CREATED', {
      userId: adminId,
      ipAddress,
      details: { roleId: role.id, roleName: role.name, level: role.level },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      level: role.level,
      createdAt: role.createdAt,
    };
  }

  async listRoles(dto: ListRolesDto, adminId: string, adminRole: string, ipAddress: string) {
    this.validateSuperAdminAccess(adminRole);

    const result = await this.identityRepository.listRoles(
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.search,
    );

    await this.auditService.log('ROLES_LISTED', {
      userId: adminId,
      ipAddress,
    });

    return {
      roles: result.items.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        level: r.level,
        createdAt: r.createdAt,
        permissions: r.permissions.map(p => ({
          id: p.id,
          resource: p.resource,
          action: p.action,
          createdAt: p.createdAt,
        })),
      })),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async getRole(roleId: string, adminId: string, adminRole: string, ipAddress: string) {
    this.validateSuperAdminAccess(adminRole);

    const role = await this.identityRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        success: false,
        error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' },
      });
    }

    await this.auditService.log('ROLE_VIEWED', {
      userId: adminId,
      ipAddress,
      details: { roleId },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      level: role.level,
      createdAt: role.createdAt,
      permissions: role.permissions.map(p => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        createdAt: p.createdAt,
      })),
    };
  }

  async updateRole(
    roleId: string,
    dto: UpdateRoleDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateSuperAdminAccess(adminRole);

    const role = await this.identityRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        success: false,
        error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' },
      });
    }

    const isSystemRole = await this.identityRepository.isSystemRole(role.name);
    if (isSystemRole) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_MODIFY_SYSTEM_ROLE', message: 'Cannot modify system role' },
      });
    }

    const updatedRole = await this.identityRepository.updateRole(roleId, {
      description: dto.description,
      level: dto.level,
    });

    await this.auditService.log('ROLE_UPDATED', {
      userId: adminId,
      ipAddress,
      details: {
        roleId,
        updates: dto,
        diff: {
          description: { from: role.description, to: dto.description },
          level: { from: role.level, to: dto.level },
        },
      },
    });

    return {
      id: updatedRole.id,
      name: updatedRole.name,
      description: updatedRole.description,
      level: updatedRole.level,
      createdAt: updatedRole.createdAt,
    };
  }

  async deleteRole(roleId: string, adminId: string, adminRole: string, ipAddress: string) {
    this.validateSuperAdminAccess(adminRole);

    const role = await this.identityRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        success: false,
        error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' },
      });
    }

    const isSystemRole = await this.identityRepository.isSystemRole(role.name);
    if (isSystemRole) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_DELETE_SYSTEM_ROLE', message: 'Cannot delete system role' },
      });
    }

    if (role.name === 'SUPER_ADMIN') {
      const superAdminCount = await this.identityRepository.countSuperAdmins();
      if (superAdminCount <= 1) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'CANNOT_DELETE_LAST_SUPER_ADMIN', message: 'Cannot delete the last SUPER_ADMIN role' },
        });
      }
    }

    const assignedCount = await this.identityRepository.countRoleAssignments(roleId);
    if (assignedCount > 0) {
      throw new BadRequestException({
        success: false,
        error: { code: 'ROLE_ASSIGNED', message: `Cannot delete role with ${assignedCount} assigned users` },
      });
    }

    await this.identityRepository.atomicDeleteRole(roleId);

    await this.auditService.log('ROLE_DELETED', {
      userId: adminId,
      ipAddress,
      details: { roleId, roleName: role.name },
    });

    return { message: 'Role deleted successfully', roleId };
  }

  async assignPermissions(
    roleId: string,
    dto: AssignPermissionsDto,
    adminId: string,
    adminRole: string,
    ipAddress: string,
  ) {
    this.validateSuperAdminAccess(adminRole);

    const role = await this.identityRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        success: false,
        error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' },
      });
    }

    if (role.name === 'SUPER_ADMIN' && adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_MODIFY_SUPER_ADMIN', message: 'Cannot modify SUPER_ADMIN permissions' },
      });
    }

    const invalidPermissions = dto.permissions.filter(p => !this.isValidPermissionFormat(p));
    if (invalidPermissions.length > 0) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_PERMISSION_FORMAT', message: `Invalid permission format: ${invalidPermissions.join(', ')}` },
      });
    }

    const escalationPatterns = ['super_admin:', 'admin:'];
    const hasEscalationPermissions = dto.permissions.some(p =>
      escalationPatterns.some(pattern => p.toLowerCase().startsWith(pattern))
    );

    if (hasEscalationPermissions && role.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'PRIVILEGE_ESCALATION', message: 'Cannot assign escalation permissions to non-SUPER_ADMIN roles' },
      });
    }

    const oldPermissions = role.permissions.map(p => `${p.resource}:${p.action}`);

    await this.identityRepository.deletePermissionsByRoleId(roleId);

    const permissionData = dto.permissions.map(p => {
      const [resource, action] = p.split(':');
      return { roleId, resource, action };
    });

    const permissions = await this.identityRepository.createPermissions(permissionData);

    await this.auditService.log('PERMISSIONS_ASSIGNED', {
      userId: adminId,
      ipAddress,
      details: {
        roleId,
        permissionCount: permissions.length,
        oldPermissions,
        newPermissions: dto.permissions,
        diff: { permissions: { from: oldPermissions, to: dto.permissions } },
      },
    });

    return {
      message: 'Permissions assigned successfully',
      permissions: permissions.map(p => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        createdAt: p.createdAt,
      })),
    };
  }

  async listPermissions(dto: ListPermissionsDto, adminId: string, adminRole: string, ipAddress: string) {
    this.validateSuperAdminAccess(adminRole);

    const result = await this.identityRepository.listPermissions(
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.roleId,
    );

    await this.auditService.log('PERMISSIONS_LISTED', {
      userId: adminId,
      ipAddress,
    });

    return {
      permissions: result.items.map(p => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        createdAt: p.createdAt,
        roleId: (p as any).role?.id,
        roleName: (p as any).role?.name,
      })),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  private validateAdminAccess(role: string): void {
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' },
      });
    }
  }

  private validateSuperAdminAccess(role: string): void {
    if (role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Super admin access required' },
      });
    }
  }

  private isValidPermissionFormat(permission: string): boolean {
    return /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]+$/.test(permission);
  }

  private mapUserToResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      verifiedAt: user.verifiedAt,
      lastLoginAt: user.lastLoginAt,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private mapSessionToResponse(session: any) {
    return {
      id: session.id,
      familyId: session.familyId,
      deviceFingerprint: session.deviceFingerprint ? this.sanitizeFingerprint(session.deviceFingerprint) : null,
      ipAddress: this.sanitizeIp(session.ipAddress),
      userAgent: this.sanitizeUserAgent(session.userAgent),
      isRevoked: session.isRevoked,
      revokedAt: session.revokedAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  private sanitizeFingerprint(fp: string): string {
    if (!fp || fp.length < 8) return '***';
    return fp.substring(0, 4) + '***' + fp.substring(fp.length - 4);
  }

  private sanitizeIp(ip: string | null): string | null {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return parts[0] + '.' + parts[1] + '.***.' + parts[3];
    }
    return '***';
  }

  private sanitizeUserAgent(ua: string | null): string | null {
    if (!ua) return null;
    if (ua.length > 50) {
      return ua.substring(0, 30) + '...';
    }
    return ua;
  }
}
