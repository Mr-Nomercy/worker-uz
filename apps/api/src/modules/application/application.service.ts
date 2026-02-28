import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../auth/audit.service';
import { ApplicationRepository } from './application.repository';
import { WorkerService } from '../worker/worker.service';
import { EmployerService } from '../employer/employer.service';
import {
  ApplyToVacancyDto,
  ListApplicationsDto,
  ListVacancyApplicationsDto,
  UpdateApplicationStatusDto,
  WithdrawApplicationDto,
} from './dto/application.dto';
import { ApplicationResponseDto, ApplicationListResponseDto, ApplyResponseDto, WithdrawResponseDto, StatusUpdateResponseDto, ApplicationDetailResponseDto } from './dto/application-response.dto';
import { ApplicationStatus, VacancyStatus } from '@prisma/client';

const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
  ApplicationStatus.HIRED,
];

const WITHDRAW_BLOCKED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.INTERVIEW_INVITED,
  ApplicationStatus.HIRED,
];

const STATUS_ORDER: Record<ApplicationStatus, number> = {
  [ApplicationStatus.PENDING_REVIEW]: 1,
  [ApplicationStatus.SHORTLISTED]: 2,
  [ApplicationStatus.INTERVIEW_INVITED]: 3,
  [ApplicationStatus.REJECTED]: 4,
  [ApplicationStatus.WITHDRAWN]: 5,
  [ApplicationStatus.HIRED]: 6,
};

const VALID_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.PENDING_REVIEW]: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED],
  [ApplicationStatus.SHORTLISTED]: [ApplicationStatus.INTERVIEW_INVITED, ApplicationStatus.REJECTED],
  [ApplicationStatus.INTERVIEW_INVITED]: [ApplicationStatus.REJECTED, ApplicationStatus.HIRED],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
  [ApplicationStatus.HIRED]: [],
};

@Injectable()
export class ApplicationService {
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly auditService: AuditService,
    private readonly workerService: WorkerService,
    private readonly employerService: EmployerService,
  ) {}

  private validateStatusTransition(currentStatus: ApplicationStatus, targetStatus: ApplicationStatus): void {
    if (TERMINAL_STATUSES.includes(currentStatus)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition from terminal status ${currentStatus}`,
        },
      });
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition from ${currentStatus} to ${targetStatus}. Valid transitions: ${allowedTransitions?.join(', ') || 'none'}`,
        },
      });
    }
  }

  private canWithdraw(currentStatus: ApplicationStatus): boolean {
    return !WITHDRAW_BLOCKED_STATUSES.includes(currentStatus) && !TERMINAL_STATUSES.includes(currentStatus);
  }

  async applyToVacancy(
    workerUserId: string,
    dto: ApplyToVacancyDto,
    ipAddress: string,
  ): Promise<ApplyResponseDto> {
    const vacancyStatus = await this.applicationRepository.checkVacancyStatus(dto.vacancyId);
    if (vacancyStatus !== VacancyStatus.OPEN) {
      throw new BadRequestException({
        success: false,
        error: { code: 'VACANCY_NOT_OPEN', message: 'Vacancy is not open for applications' },
      });
    }

    const cvSnapshot = await this.applicationRepository.getCurrentCvSnapshot(workerUserId);
    if (!cvSnapshot) {
      throw new BadRequestException({
        success: false,
        error: { code: 'NO_CV_SNAPSHOT', message: 'No verified CV snapshot found' },
      });
    }

    let application;
    try {
      application = await this.applicationRepository.createApplication(
        dto.vacancyId,
        workerUserId,
        cvSnapshot.id,
      );
    } catch (error: any) {
      if (error.message === 'DUPLICATE_APPLICATION') {
        throw new BadRequestException({
          success: false,
          error: { code: 'DUPLICATE_APPLICATION', message: 'You have already applied to this vacancy' },
        });
      }
      throw error;
    }

    await this.auditService.log('APPLICATION_SUBMITTED', {
      userId: workerUserId,
      targetUserId: workerUserId,
      ipAddress,
      details: {
        applicationId: application.id,
        vacancyId: dto.vacancyId,
        cvSnapshotId: cvSnapshot.id,
      },
    });

    return {
      message: 'Application submitted successfully',
      application: this.sanitizeApplication(application),
    };
  }

  async getMyApplication(
    workerUserId: string,
    applicationId: string,
    ipAddress: string,
  ): Promise<ApplicationDetailResponseDto> {
    const application = await this.applicationRepository.findApplicationByIdAndUser(applicationId, workerUserId);
    if (!application) {
      throw new NotFoundException({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found' },
      });
    }

    await this.auditService.log('WORKER_APPLICATION_VIEWED', {
      userId: workerUserId,
      ipAddress,
      details: { applicationId },
    });

    return {
      application: this.sanitizeApplication(application),
      vacancy: application.vacancy,
      cvSnapshot: application.cvSnapshot,
    };
  }

  async listMyApplications(
    workerUserId: string,
    dto: ListApplicationsDto,
    ipAddress: string,
  ): Promise<ApplicationListResponseDto> {
    const result = await this.applicationRepository.listApplicationsForUser(
      workerUserId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status,
    );

    await this.auditService.log('WORKER_APPLICATIONS_LISTED', {
      userId: workerUserId,
      ipAddress,
      details: { count: result.totalCount },
    });

    return {
      items: result.items.map(a => this.sanitizeApplication(a)),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async withdrawApplication(
    workerUserId: string,
    applicationId: string,
    dto: WithdrawApplicationDto,
    ipAddress: string,
  ): Promise<WithdrawResponseDto> {
    const application = await this.applicationRepository.findApplicationByIdAndUser(applicationId, workerUserId);
    if (!application) {
      throw new NotFoundException({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found' },
      });
    }

    if (!this.canWithdraw(application.status)) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_WITHDRAW', message: `Cannot withdraw application in ${application.status} status` },
      });
    }

    const hasInterview = await this.applicationRepository.hasInterview(applicationId);
    if (hasInterview) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_WITHDRAW', message: 'Cannot withdraw application with scheduled interview' },
      });
    }

    const withdrawn = await this.applicationRepository.withdrawApplication(
      applicationId,
      workerUserId,
      dto.reason,
    );

    await this.auditService.log('APPLICATION_WITHDRAWN', {
      userId: workerUserId,
      ipAddress,
      details: { applicationId, vacancyId: application.vacancyId, reason: dto.reason },
    });

    return {
      message: 'Application withdrawn successfully',
      application: this.sanitizeApplication(withdrawn),
    };
  }

  async listVacancyApplications(
    employerUserId: string,
    vacancyId: string,
    dto: ListVacancyApplicationsDto,
    ipAddress: string,
  ): Promise<ApplicationListResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const isOwner = await this.applicationRepository.validateVacancyOwnership(vacancyId, employer.id);
    if (!isOwner) {
      const hasRecruiterAccess = await this.applicationRepository.validateRecruiterAccess(vacancyId, employerUserId);
      if (!hasRecruiterAccess) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Not authorized to view applications for this vacancy' },
        });
      }
    }

    const result = await this.applicationRepository.listApplicationsForVacancy(
      vacancyId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status,
      dto.search,
    );

    await this.auditService.log('EMPLOYER_APPLICATIONS_LISTED', {
      userId: employerUserId,
      ipAddress,
      details: { vacancyId, count: result.totalCount },
    });

    return {
      items: result.items.map(a => this.sanitizeApplication(a)),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async updateApplicationStatus(
    employerUserId: string,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
    ipAddress: string,
  ): Promise<StatusUpdateResponseDto> {
    const application = await this.applicationRepository.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundException({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found' },
      });
    }

    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const isOwner = await this.applicationRepository.validateVacancyOwnership(application.vacancyId, employer.id);
    if (!isOwner) {
      const hasRecruiterAccess = await this.applicationRepository.validateRecruiterAccess(application.vacancyId, employerUserId);
      if (!hasRecruiterAccess) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Not authorized to update this application' },
        });
      }
    }

    this.validateStatusTransition(application.status, dto.status);

    const updated = await this.applicationRepository.updateApplicationStatus(
      applicationId,
      dto.status,
      employerUserId,
      dto.reason,
      dto.employerNotes,
    );

    await this.auditService.log('APPLICATION_STATUS_UPDATED', {
      userId: employerUserId,
      targetUserId: application.userId,
      ipAddress,
      details: {
        applicationId,
        vacancyId: application.vacancyId,
        previousStatus: application.status,
        newStatus: dto.status,
        reason: dto.reason,
      },
    });

    return {
      message: 'Application status updated successfully',
      application: this.sanitizeApplication(updated),
    };
  }

  private sanitizeApplication(application: any): ApplicationResponseDto {
    return {
      id: application.id,
      vacancyId: application.vacancyId,
      userId: application.userId,
      cvSnapshotId: application.cvSnapshotId,
      currentVersion: application.currentVersion,
      status: application.status,
      employerNotes: application.employerNotes,
      appliedAt: application.appliedAt,
      reviewedAt: application.reviewedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}
