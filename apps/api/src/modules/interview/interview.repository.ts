import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, Interview, InterviewStatus, ApplicationStatus, InterviewMode } from '@prisma/client';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class InterviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInterviewById(interviewId: string): Promise<Interview | null> {
    return this.prisma.interview.findUnique({
      where: { id: interviewId, deletedAt: null },
      include: {
        application: true,
        vacancy: true,
        schedule: true,
      },
    });
  }

  async findInterviewByIdForWorker(interviewId: string, userId: string): Promise<Interview | null> {
    return this.prisma.interview.findFirst({
      where: { id: interviewId, userId, deletedAt: null },
      include: {
        application: true,
        vacancy: true,
        schedule: true,
      },
    });
  }

  async findInterviewByIdForEmployer(interviewId: string, employerId: string): Promise<Interview | null> {
    return this.prisma.interview.findFirst({
      where: { id: interviewId, employerId, deletedAt: null },
      include: {
        application: true,
        vacancy: true,
        schedule: true,
      },
    });
  }

  async findInterviewByApplicationId(applicationId: string): Promise<Interview | null> {
    return this.prisma.interview.findUnique({
      where: { applicationId, deletedAt: null },
    });
  }

  async getApplicationVacancyId(applicationId: string): Promise<string | null> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId, deletedAt: null },
      select: { vacancyId: true },
    });
    return application?.vacancyId ?? null;
  }

  async listInterviewsForWorker(
    userId: string,
    page: number,
    pageSize: number,
    status?: InterviewStatus,
  ): Promise<PaginatedResult<Interview>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.InterviewWhereInput = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { invitedAt: 'desc' },
        include: {
          vacancy: true,
          application: true,
          schedule: true,
        },
      }),
      this.prisma.interview.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async listInterviewsForVacancy(
    vacancyId: string,
    page: number,
    pageSize: number,
    status?: InterviewStatus,
    search?: string,
  ): Promise<PaginatedResult<Interview>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.InterviewWhereInput = {
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
      this.prisma.interview.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { invitedAt: 'desc' },
        include: {
          user: true,
          application: true,
          schedule: true,
        },
      }),
      this.prisma.interview.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async checkApplicationStatus(applicationId: string): Promise<ApplicationStatus | null> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId, deletedAt: null },
      select: { status: true },
    });
    return application?.status ?? null;
  }

  async validateVacancyOwnership(vacancyId: string, employerId: string): Promise<boolean> {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, employerId, deletedAt: null },
    });
    return !!vacancy;
  }

  async checkOverlappingInterviews(
    userId: string,
    employerId: string,
    scheduledDatetime: Date,
    durationMinutes: number,
    excludeInterviewId?: string,
  ): Promise<Interview | null> {
    const startTime = scheduledDatetime;
    const endTime = new Date(scheduledDatetime.getTime() + durationMinutes * 60000);

    const activeStatuses = [InterviewStatus.INVITED, InterviewStatus.ACCEPTED, InterviewStatus.SCHEDULED];

    const where: Prisma.InterviewWhereInput = {
      deletedAt: null,
      status: { in: activeStatuses },
      OR: [
        { userId },
        { employerId },
      ],
    };

    if (excludeInterviewId) {
      where.id = { not: excludeInterviewId };
    }

    const interviews = await this.prisma.interview.findMany({
      where,
      include: {
        schedule: true,
      },
    });

    for (const interview of interviews) {
      if (!interview.schedule) continue;
      
      const existingStart = interview.schedule.scheduledDatetime;
      const existingEnd = new Date(existingStart.getTime() + interview.schedule.durationMinutes * 60000);
      
      if (existingStart < endTime && existingEnd > startTime) {
        return interview;
      }
    }

    return null;
  }

  async scheduleInterview(
    applicationId: string,
    userId: string,
    employerId: string,
    recruiterId: string | null,
    scheduledDatetime: Date,
    durationMinutes: number,
    mode: InterviewMode,
    location?: string,
    meetingLink?: string,
  ): Promise<Interview> {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { vacancy: true },
      });

      if (!application) {
        throw new Error('APPLICATION_NOT_FOUND');
      }

      const startTime = scheduledDatetime;
      const endTime = new Date(scheduledDatetime.getTime() + durationMinutes * 60000);
      const activeStatuses = [InterviewStatus.INVITED, InterviewStatus.ACCEPTED, InterviewStatus.SCHEDULED];

      const existingInterviews = await tx.interview.findMany({
        where: {
          deletedAt: null,
          status: { in: activeStatuses },
          OR: [
            { userId },
            { employerId },
          ],
        },
        include: {
          schedule: true,
        },
      });

      for (const interview of existingInterviews) {
        if (!interview.schedule) continue;
        
        const existingStart = interview.schedule.scheduledDatetime;
        const existingEnd = new Date(existingStart.getTime() + interview.schedule.durationMinutes * 60000);
        
        if (existingStart < endTime && existingEnd > startTime) {
          throw new Error('OVERLAPPING_INTERVIEW');
        }
      }

      const interview = await tx.interview.create({
        data: {
          applicationId,
          vacancyId: application.vacancyId,
          userId,
          employerId,
          recruiterId,
          status: InterviewStatus.INVITED,
          scheduledAt: scheduledDatetime,
          mode,
          location,
        },
      });

      await tx.interviewSchedule.create({
        data: {
          interviewId: interview.id,
          scheduledDatetime,
          durationMinutes,
          mode,
          location,
          meetingLink,
          employerConfirmed: true,
          employerConfirmedAt: new Date(),
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          action: 'INTERVIEW_SCHEDULED',
          newValue: JSON.stringify({ scheduledDatetime, durationMinutes, mode }),
          changedBy: employerId,
        },
      });

      return interview;
    });
  }

  async confirmInterview(interviewId: string, userId: string): Promise<Interview> {
    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { id: interviewId },
      });

      if (!interview) {
        throw new Error('INTERVIEW_NOT_FOUND');
      }

      const updated = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: InterviewStatus.ACCEPTED,
          respondedAt: new Date(),
        },
        include: {
          schedule: true,
        },
      });

      await tx.interviewSchedule.update({
        where: { interviewId },
        data: {
          workerConfirmed: true,
          workerConfirmedAt: new Date(),
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId,
          action: 'WORKER_CONFIRMED',
          changedBy: userId,
        },
      });

      return updated;
    });
  }

  async rejectInterview(interviewId: string, userId: string, reason: string): Promise<Interview> {
    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { id: interviewId },
      });

      if (!interview) {
        throw new Error('INTERVIEW_NOT_FOUND');
      }

      const updated = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: InterviewStatus.DECLINED,
          respondedAt: new Date(),
        },
        include: {
          schedule: true,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId,
          action: 'WORKER_REJECTED',
          reason,
          changedBy: userId,
        },
      });

      return updated;
    });
  }

  async cancelInterview(interviewId: string, changedBy: string, reason?: string): Promise<Interview> {
    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { id: interviewId },
      });

      if (!interview) {
        throw new Error('INTERVIEW_NOT_FOUND');
      }

      const updated = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: InterviewStatus.CANCELLED,
        },
        include: {
          schedule: true,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId,
          action: 'INTERVIEW_CANCELLED',
          oldValue: interview.status,
          newValue: InterviewStatus.CANCELLED,
          changedBy,
          reason,
        },
      });

      return updated;
    });
  }

  async completeInterview(
    interviewId: string,
    changedBy: string,
    outcome: 'HIRED' | 'REJECTED' | 'PENDING_FURTHER_REVIEW',
    feedback?: string,
    internalFeedback?: string,
    hiredSalary?: number,
    hiredStartDate?: Date,
    contractDetails?: Record<string, any>,
  ): Promise<Interview> {
    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { id: interviewId },
      });

      if (!interview) {
        throw new Error('INTERVIEW_NOT_FOUND');
      }

      const updated = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: InterviewStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          schedule: true,
        },
      });

      await tx.interviewResult.create({
        data: {
          interviewId,
          outcome,
          outcomeDate: new Date(),
          feedback,
          internalFeedback,
          hiredSalary: hiredSalary ? new Prisma.Decimal(hiredSalary) : undefined,
          hiredStartDate,
          contractDetails,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId,
          action: 'INTERVIEW_COMPLETED',
          oldValue: interview.status,
          newValue: InterviewStatus.COMPLETED,
          changedBy,
        },
      });

      if (outcome === 'HIRED') {
        await tx.application.update({
          where: { id: interview.applicationId },
          data: { status: 'HIRED' as ApplicationStatus },
        });
      }

      return updated;
    });
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
