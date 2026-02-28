import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, Application, ApplicationStatus, VacancyStatus } from '@prisma/client';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findApplicationById(applicationId: string): Promise<Application | null> {
    return this.prisma.application.findUnique({
      where: { id: applicationId, deletedAt: null },
      include: {
        vacancy: true,
        cvSnapshot: true,
      },
    });
  }

  async findApplicationByIdAndUser(applicationId: string, userId: string): Promise<(Application & { vacancy: any; cvSnapshot: any }) | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      include: {
        vacancy: true,
        cvSnapshot: true,
      },
    });
  }

  async findApplicationByVacancyAndUser(vacancyId: string, userId: string): Promise<Application | null> {
    return this.prisma.application.findFirst({
      where: { vacancyId, userId, deletedAt: null },
    });
  }

  async findVacancyById(vacancyId: string): Promise<any> {
    return this.prisma.vacancy.findUnique({
      where: { id: vacancyId, deletedAt: null },
    });
  }

  async getCurrentCvSnapshot(userId: string): Promise<any> {
    return this.prisma.cvSnapshot.findFirst({
      where: { userId, isCurrent: true, deletedAt: null },
    });
  }

  async listApplicationsForUser(
    userId: string,
    page: number,
    pageSize: number,
    status?: ApplicationStatus,
  ): Promise<PaginatedResult<Application>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.ApplicationWhereInput = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { appliedAt: 'desc' },
        include: {
          vacancy: true,
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async listApplicationsForVacancy(
    vacancyId: string,
    page: number,
    pageSize: number,
    status?: ApplicationStatus,
    search?: string,
  ): Promise<PaginatedResult<Application>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.ApplicationWhereInput = {
      vacancyId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.user = {
        email: { contains: search, mode: 'insensitive' },
      };
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { appliedAt: 'desc' },
        include: {
          user: true,
          cvSnapshot: true,
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async createApplication(
    vacancyId: string,
    userId: string,
    cvSnapshotId: string,
  ): Promise<Application> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingApplication = await tx.application.findFirst({
          where: {
            vacancyId,
            userId,
            deletedAt: null,
            status: { notIn: [ApplicationStatus.WITHDRAWN, ApplicationStatus.REJECTED] },
          },
        });

        if (existingApplication) {
          throw new Error('DUPLICATE_APPLICATION');
        }

        const cvSnapshot = await tx.cvSnapshot.findUnique({
          where: { id: cvSnapshotId },
        });

        const application = await tx.application.create({
          data: {
            vacancyId,
            userId,
            cvSnapshotId,
            status: ApplicationStatus.PENDING_REVIEW,
          },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId: application.id,
            versionNumber: 1,
            status: ApplicationStatus.PENDING_REVIEW,
            changedBy: userId,
          },
        });

        await tx.applicationVersion.create({
          data: {
            applicationId: application.id,
            versionNumber: 1,
            cvSnapshotId,
            snapshotData: cvSnapshot?.snapshotData || {},
            statusAtTime: ApplicationStatus.PENDING_REVIEW,
            isCurrent: true,
          },
        });

        await tx.vacancy.update({
          where: { id: vacancyId },
          data: { applicationCount: { increment: 1 } },
        });

        return application;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          error: { code: 'DUPLICATE_APPLICATION', message: 'You have already applied to this vacancy' },
        });
      }
      if (error.message === 'DUPLICATE_APPLICATION') {
        throw new ConflictException({
          success: false,
          error: { code: 'DUPLICATE_APPLICATION', message: 'You have already applied to this vacancy' },
        });
      }
      throw error;
    }
  }

  async updateApplicationStatus(
    applicationId: string,
    newStatus: ApplicationStatus,
    changedBy: string,
    reason?: string,
    employerNotes?: string,
  ): Promise<Application> {
    return this.prisma.$transaction(async (tx) => {
      const currentApplication = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!currentApplication) {
        throw new Error('APPLICATION_NOT_FOUND');
      }

      const currentVersion = currentApplication.currentVersion;
      const nextVersion = currentVersion + 1;

      const updateData: Prisma.ApplicationUpdateInput = {
        status: newStatus,
        reviewedAt: new Date(),
        currentVersion: nextVersion,
      };

      if (employerNotes !== undefined) {
        updateData.employerNotes = employerNotes;
      }

      try {
        const updated = await tx.application.update({
          where: {
            id: applicationId,
            currentVersion: currentVersion,
          },
          data: updateData,
          include: {
            vacancy: true,
            cvSnapshot: true,
          },
        });

        await tx.applicationStatusHistory.create({
          data: {
            applicationId,
            versionNumber: nextVersion,
            status: newStatus,
            changedBy,
            reason,
          },
        });

        await tx.applicationVersion.create({
          data: {
            applicationId,
            versionNumber: nextVersion,
            cvSnapshotId: currentApplication.cvSnapshotId,
            snapshotData: (await tx.cvSnapshot.findUnique({ where: { id: currentApplication.cvSnapshotId } }))?.snapshotData || {},
            statusAtTime: newStatus,
            isCurrent: true,
          },
        });

        await tx.applicationVersion.updateMany({
          where: { applicationId, isCurrent: true, NOT: { id: applicationId } },
          data: { isCurrent: false },
        });

        return updated;
      } catch (error: any) {
        if (error.code === 'P2025') {
          throw new ConflictException({
            success: false,
            error: { code: 'VERSION_CONFLICT', message: 'Application was updated by another user. Please refresh and try again.' },
          });
        }
        throw error;
      }
    });
  }

  async withdrawApplication(
    applicationId: string,
    userId: string,
    reason?: string,
  ): Promise<Application> {
    return this.prisma.$transaction(async (tx) => {
      const currentApplication = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!currentApplication) {
        throw new Error('APPLICATION_NOT_FOUND');
      }

      const currentVersion = currentApplication.currentVersion;
      const nextVersion = currentVersion + 1;

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.WITHDRAWN,
        },
        include: {
          vacancy: true,
          cvSnapshot: true,
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          versionNumber: nextVersion,
          status: ApplicationStatus.WITHDRAWN,
          changedBy: userId,
          reason,
        },
      });

      await tx.applicationVersion.create({
        data: {
          applicationId,
          versionNumber: nextVersion,
          cvSnapshotId: currentApplication.cvSnapshotId,
          snapshotData: (await tx.cvSnapshot.findUnique({ where: { id: currentApplication.cvSnapshotId } }))?.snapshotData || {},
          statusAtTime: ApplicationStatus.WITHDRAWN,
          isCurrent: true,
        },
      });

      await tx.applicationVersion.updateMany({
        where: { applicationId, isCurrent: true, NOT: { id: applicationId } },
        data: { isCurrent: false },
      });

      return updated;
    });
  }

  async checkVacancyStatus(vacancyId: string): Promise<VacancyStatus | null> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId, deletedAt: null },
      select: { status: true },
    });
    return vacancy?.status ?? null;
  }

  async hasInterview(applicationId: string): Promise<boolean> {
    const interview = await this.prisma.interview.findUnique({
      where: { applicationId },
    });
    return !!interview;
  }

  async validateVacancyOwnership(vacancyId: string, employerId: string): Promise<boolean> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, employerId, deletedAt: null },
    });
    return !!vacancy;
  }

  async validateRecruiterAccess(vacancyId: string, recruiterUserId: string): Promise<boolean> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
      include: {
        employer: {
          include: {
            recruiters: {
              where: { userId: recruiterUserId, status: 'ACTIVE' as any },
            },
          },
        },
      },
    });

    if (!vacancy) return false;
    return vacancy.employer.recruiters.length > 0;
  }
}
