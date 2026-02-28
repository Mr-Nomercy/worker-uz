import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, User, UserStatus, UserRole, Role, Permission, Session } from '@prisma/client';

interface UserListParams {
  page: number;
  pageSize: number;
  status?: UserStatus;
  role?: UserRole;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'WORKER', 'EMPLOYER'];
const MAX_PAGESIZE = 100;

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findUserById(id: string, includeDeleted = false): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: includeDeleted ? { id } : { id, deletedAt: null },
      include: {
        workerProfile: true,
        employer: true,
        recruiter: true,
      },
    });
  }

  async listUsers(params: UserListParams): Promise<PaginatedResult<User>> {
    const { page, pageSize, status, role, search, createdAfter, createdBefore } = params;
    const enforcedPageSize = Math.min(pageSize, MAX_PAGESIZE);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { email: { search } },
        { phone: { search } },
      ];
    }

    if (createdAfter || createdBefore) {
      where.createdAt = {};
      if (createdAfter) {
        where.createdAt.gte = createdAfter;
      }
      if (createdBefore) {
        where.createdAt.lte = createdBefore;
      }
    }

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          workerProfile: true,
          employer: true,
          recruiter: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        verifiedAt: status === UserStatus.ACTIVE ? new Date() : undefined,
      },
    });
  }

  async softDeleteUser(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  async restoreUser(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
  }

  async findSessionsByUserId(userId: string, page: number, pageSize: number): Promise<PaginatedResult<Session>> {
    const enforcedPageSize = Math.min(pageSize, MAX_PAGESIZE);

    const [sessions, totalCount] = await Promise.all([
      this.prisma.session.findMany({
        where: { userId },
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          familyId: true,
          deviceFingerprint: true,
          ipAddress: true,
          userAgent: true,
          isRevoked: true,
          revokedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.session.count({ where: { userId } }),
    ]);

    return {
      items: sessions as unknown as Session[],
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async findSessionById(sessionId: string): Promise<{ id: string; userId: string; familyId: string; isRevoked: boolean; revokedAt: Date | null } | null> {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        familyId: true,
        isRevoked: true,
        revokedAt: true,
      },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isRevoked: false },
      select: { familyId: true },
    });

    const familyIds = [...new Set(sessions.map(s => s.familyId))];
    let count = 0;

    for (const familyId of familyIds) {
      count += await this.revokeFamily(familyId);
    }

    return count;
  }

  async createRole(data: { name: string; description?: string; level: number }): Promise<Role> {
    return this.prisma.role.create({
      data,
    });
  }

  async findRoleById(roleId: string): Promise<(Role & { permissions: Permission[] }) | null> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
    return role as (Role & { permissions: Permission[] }) | null;
  }

  async findRoleByName(name: string): Promise<(Role & { permissions: Permission[] }) | null> {
    const role = await this.prisma.role.findUnique({
      where: { name },
      include: { permissions: true },
    });
    return role as (Role & { permissions: Permission[] }) | null;
  }

  async listRoles(page: number, pageSize: number, search?: string): Promise<PaginatedResult<Role & { permissions: Permission[] }>> {
    const enforcedPageSize = Math.min(pageSize, MAX_PAGESIZE);

    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [roles, totalCount] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { level: 'desc' },
        include: { permissions: true },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      items: roles as (Role & { permissions: Permission[] })[],
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async updateRole(roleId: string, data: { description?: string; level?: number }): Promise<Role> {
    return this.prisma.role.update({
      where: { id: roleId },
      data,
    });
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.prisma.role.delete({
      where: { id: roleId },
    });
  }

  async isSystemRole(roleName: string): Promise<boolean> {
    return SYSTEM_ROLES.includes(roleName);
  }

  async countUsersWithRole(roleName: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: roleName as UserRole,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }

  async countSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: 'SUPER_ADMIN' as UserRole,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }

  async countAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        OR: [{ role: 'ADMIN' as UserRole }, { role: 'SUPER_ADMIN' as UserRole }],
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }

  async countRoleAssignments(roleId: string): Promise<number> {
    return this.prisma.userRoleRelation.count({
      where: { roleId },
    });
  }

  async createPermission(data: { roleId: string; resource: string; action: string }): Promise<Permission> {
    return this.prisma.permission.create({
      data,
    });
  }

  async createPermissions(data: { roleId: string; resource: string; action: string }[]): Promise<Permission[]> {
    return this.prisma.permission.createManyAndReturn({
      data,
    });
  }

  async deletePermission(permissionId: string): Promise<void> {
    await this.prisma.permission.delete({
      where: { id: permissionId },
    });
  }

  async deletePermissionsByRoleId(roleId: string): Promise<number> {
    const result = await this.prisma.permission.deleteMany({
      where: { roleId },
    });
    return result.count;
  }

  async findPermissionsByRoleId(roleId: string): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: { roleId },
      orderBy: { resource: 'asc' },
    });
  }

  async listPermissions(page: number, pageSize: number, roleId?: string): Promise<PaginatedResult<Permission>> {
    const enforcedPageSize = Math.min(pageSize, MAX_PAGESIZE);

    const where: Prisma.PermissionWhereInput = roleId ? { roleId } : {};

    const [permissions, totalCount] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
        include: { role: { select: { id: true, name: true } } },
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      items: permissions,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async getUserRole(userId: string): Promise<Role | null> {
    const userRole = await this.prisma.userRoleRelation.findFirst({
      where: { userId },
      include: { role: true },
    });
    return userRole?.role || null;
  }

  async atomicRoleUpdateWithSessionRevoke(
    userId: string,
    newRole: UserRole,
    oldRole: UserRole,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      const sessions = await tx.session.findMany({
        where: { userId, isRevoked: false },
        select: { familyId: true },
      });

      const familyIds = [...new Set(sessions.map(s => s.familyId))];
      for (const familyId of familyIds) {
        await tx.session.updateMany({
          where: { familyId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      return updatedUser;
    });
  }

  async atomicStatusUpdateWithSessionRevoke(
    userId: string,
    newStatus: UserStatus,
    oldStatus: UserStatus,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          status: newStatus,
          verifiedAt: newStatus === UserStatus.ACTIVE ? new Date() : undefined,
        },
      });

      if (newStatus !== oldStatus) {
        const sessions = await tx.session.findMany({
          where: { userId, isRevoked: false },
          select: { familyId: true },
        });

        const familyIds = [...new Set(sessions.map(s => s.familyId))];
        for (const familyId of familyIds) {
          await tx.session.updateMany({
            where: { familyId, isRevoked: false },
            data: { isRevoked: true, revokedAt: new Date() },
          });
        }
      }

      return updatedUser;
    });
  }

  async atomicSoftDeleteWithSessionRevoke(userId: string): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const deletedUser = await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      const sessions = await tx.session.findMany({
        where: { userId, isRevoked: false },
        select: { familyId: true },
      });

      const familyIds = [...new Set(sessions.map(s => s.familyId))];
      for (const familyId of familyIds) {
        await tx.session.updateMany({
          where: { familyId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      return deletedUser;
    });
  }

  async atomicDeleteRole(roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.permission.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });
  }

  async atomicUpdateUserRoleWithPrivilegeCheck(
    targetUserId: string,
    adminId: string,
    newRole: UserRole,
    adminRole: string,
  ): Promise<User | null> {
    if (newRole === 'SUPER_ADMIN' as UserRole && adminRole !== 'SUPER_ADMIN') {
      throw new Error('Cannot assign SUPER_ADMIN role');
    }

    return this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) return null;

      if (targetUser.role === 'SUPER_ADMIN' as UserRole && newRole !== 'SUPER_ADMIN' as UserRole) {
        const superAdminCount = await tx.user.count({
          where: {
            role: 'SUPER_ADMIN' as UserRole,
            status: UserStatus.ACTIVE,
            deletedAt: null,
          },
        });

        if (superAdminCount <= 1) {
          throw new Error('Cannot demote the last SUPER_ADMIN');
        }
      }

      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
      });

      const sessions = await tx.session.findMany({
        where: { userId: targetUserId, isRevoked: false },
        select: { familyId: true },
      });

      const familyIds = [...new Set(sessions.map(s => s.familyId))];
      for (const familyId of familyIds) {
        await tx.session.updateMany({
          where: { familyId, isRevoked: false },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      return updatedUser;
    });
  }
}
