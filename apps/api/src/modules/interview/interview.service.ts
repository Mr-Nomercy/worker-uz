import { Injectable, ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AuditService } from '../auth/audit.service';
import { InterviewRepository } from './interview.repository';
import { EmployerService } from '../employer/employer.service';
import {
  ScheduleInterviewDto,
  ConfirmInterviewDto,
  RejectInterviewDto,
  CancelInterviewDto,
  CompleteInterviewDto,
  ListInterviewsDto,
  ListVacancyInterviewsDto,
} from './dto/interview.dto';
import { InterviewResponseDto, InterviewListResponseDto, ScheduleResponseDto, ConfirmResponseDto, RejectResponseDto, CancelResponseDto, CompleteResponseDto, InterviewDetailResponseDto } from './dto/interview-response.dto';
import { InterviewStatus, ApplicationStatus } from '@prisma/client';

const TERMINAL_STATUSES: InterviewStatus[] = [
  InterviewStatus.COMPLETED,
  InterviewStatus.CANCELLED,
  InterviewStatus.NO_SHOW,
  InterviewStatus.DECLINED,
];

const VALID_STATUS_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  [InterviewStatus.INVITED]: [InterviewStatus.ACCEPTED, InterviewStatus.DECLINED, InterviewStatus.CANCELLED],
  [InterviewStatus.ACCEPTED]: [InterviewStatus.SCHEDULED, InterviewStatus.CANCELLED, InterviewStatus.NO_SHOW],
  [InterviewStatus.DECLINED]: [],
  [InterviewStatus.SCHEDULED]: [InterviewStatus.COMPLETED, InterviewStatus.CANCELLED, InterviewStatus.NO_SHOW],
  [InterviewStatus.COMPLETED]: [],
  [InterviewStatus.CANCELLED]: [],
  [InterviewStatus.NO_SHOW]: [],
};

@Injectable()
export class InterviewService {
  constructor(
    private readonly interviewRepository: InterviewRepository,
    private readonly auditService: AuditService,
    private readonly employerService: EmployerService,
  ) {}

  private validateStatusTransition(currentStatus: InterviewStatus, targetStatus: InterviewStatus): void {
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

  async scheduleInterview(
    employerUserId: string,
    dto: ScheduleInterviewDto,
    ipAddress: string,
  ): Promise<ScheduleResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const applicationStatus = await this.interviewRepository.checkApplicationStatus(dto.applicationId);
    if (applicationStatus !== ApplicationStatus.SHORTLISTED) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_APPLICATION_STATUS', message: 'Application must be SHORTLISTED to schedule interview' },
      });
    }

    const existingInterview = await this.interviewRepository.findInterviewByApplicationId(dto.applicationId);
    if (existingInterview && !TERMINAL_STATUSES.includes(existingInterview.status)) {
      throw new ConflictException({
        success: false,
        error: { code: 'INTERVIEW_EXISTS', message: 'An active interview already exists for this application' },
      });
    }

    const scheduledDatetime = new Date(dto.scheduledDatetime);
    const nowUtc = new Date(Date.now());
    if (scheduledDatetime <= nowUtc) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_SCHEDULE_TIME', message: 'Cannot schedule interview in the past' },
      });
    }

    if (dto.durationMinutes <= 0) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_DURATION', message: 'Duration must be greater than 0' },
      });
    }

    const vacancyId = await this.interviewRepository.getApplicationVacancyId(dto.applicationId);
    if (!vacancyId) {
      throw new NotFoundException({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found' },
      });
    }

    const isOwner = await this.interviewRepository.validateVacancyOwnership(vacancyId, employer.id);
    if (!isOwner) {
      const hasRecruiterAccess = await this.interviewRepository.validateRecruiterAccess(vacancyId, employerUserId);
      if (!hasRecruiterAccess) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Not authorized to schedule interview for this vacancy' },
        });
      }
    }

    const overlapping = await this.interviewRepository.checkOverlappingInterviews(
      '',
      employer.id,
      scheduledDatetime,
      dto.durationMinutes,
    );
    if (overlapping) {
      throw new ConflictException({
        success: false,
        error: { code: 'OVERLAPPING_INTERVIEW', message: 'Worker or employer has overlapping interview' },
      });
    }

    let interview;
    try {
      interview = await this.interviewRepository.scheduleInterview(
      dto.applicationId,
      '',
      employer.id,
      employerUserId,
      scheduledDatetime,
      dto.durationMinutes,
      dto.mode,
      dto.location,
      dto.meetingLink,
    );
    } catch (error: any) {
      if (error.message === 'OVERLAPPING_INTERVIEW') {
        throw new ConflictException({
          success: false,
          error: { code: 'OVERLAPPING_INTERVIEW', message: 'Worker or employer has overlapping interview' },
        });
      }
      throw error;
    }

    await this.auditService.log('INTERVIEW_SCHEDULED', {
      userId: employerUserId,
      ipAddress,
      details: {
        interviewId: interview.id,
        applicationId: dto.applicationId,
        scheduledDatetime: dto.scheduledDatetime,
        durationMinutes: dto.durationMinutes,
      },
    });

    return {
      message: 'Interview scheduled successfully',
      interview: this.sanitizeInterview(interview),
    };
  }

  async confirmInterview(
    workerUserId: string,
    interviewId: string,
    dto: ConfirmInterviewDto,
    ipAddress: string,
  ): Promise<ConfirmResponseDto> {
    const interview = await this.interviewRepository.findInterviewByIdForWorker(interviewId, workerUserId);
    if (!interview) {
      throw new NotFoundException({
        success: false,
        error: { code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found' },
      });
    }

    this.validateStatusTransition(interview.status, InterviewStatus.ACCEPTED);

    const confirmed = await this.interviewRepository.confirmInterview(interviewId, workerUserId);

    await this.auditService.log('INTERVIEW_CONFIRMED', {
      userId: workerUserId,
      ipAddress,
      details: { interviewId, applicationId: interview.applicationId },
    });

    return {
      message: 'Interview confirmed successfully',
      interview: this.sanitizeInterview(confirmed),
    };
  }

  async rejectInterview(
    workerUserId: string,
    interviewId: string,
    dto: RejectInterviewDto,
    ipAddress: string,
  ): Promise<RejectResponseDto> {
    const interview = await this.interviewRepository.findInterviewByIdForWorker(interviewId, workerUserId);
    if (!interview) {
      throw new NotFoundException({
        success: false,
        error: { code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found' },
      });
    }

    this.validateStatusTransition(interview.status, InterviewStatus.DECLINED);

    const rejected = await this.interviewRepository.rejectInterview(interviewId, workerUserId, dto.reason);

    await this.auditService.log('INTERVIEW_REJECTED', {
      userId: workerUserId,
      ipAddress,
      details: { interviewId, applicationId: interview.applicationId, reason: dto.reason },
    });

    return {
      message: 'Interview rejected successfully',
      interview: this.sanitizeInterview(rejected),
    };
  }

  async cancelInterview(
    employerUserId: string,
    interviewId: string,
    dto: CancelInterviewDto,
    ipAddress: string,
  ): Promise<CancelResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const interview = await this.interviewRepository.findInterviewById(interviewId);
    if (!interview) {
      throw new NotFoundException({
        success: false,
        error: { code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found' },
      });
    }

    const isOwner = await this.interviewRepository.validateVacancyOwnership(interview.vacancyId, employer.id);
    if (!isOwner) {
      const hasRecruiterAccess = await this.interviewRepository.validateRecruiterAccess(interview.vacancyId, employerUserId);
      if (!hasRecruiterAccess) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Not authorized to cancel this interview' },
        });
      }
    }

    this.validateStatusTransition(interview.status, InterviewStatus.CANCELLED);

    const cancelled = await this.interviewRepository.cancelInterview(interviewId, employerUserId, dto.reason);

    await this.auditService.log('INTERVIEW_CANCELLED', {
      userId: employerUserId,
      ipAddress,
      details: { interviewId, applicationId: interview.applicationId, reason: dto.reason },
    });

    return {
      message: 'Interview cancelled successfully',
      interview: this.sanitizeInterview(cancelled),
    };
  }

  async completeInterview(
    employerUserId: string,
    interviewId: string,
    dto: CompleteInterviewDto,
    ipAddress: string,
  ): Promise<CompleteResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const interview = await this.interviewRepository.findInterviewById(interviewId);
    if (!interview) {
      throw new NotFoundException({
        success: false,
        error: { code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found' },
      });
    }

    const isOwner = await this.interviewRepository.validateVacancyOwnership(interview.vacancyId, employer.id);
    if (!isOwner) {
      const hasRecruiterAccess = await this.interviewRepository.validateRecruiterAccess(interview.vacancyId, employerUserId);
      if (!hasRecruiterAccess) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Not authorized to complete this interview' },
        });
      }
    }

    this.validateStatusTransition(interview.status, InterviewStatus.COMPLETED);

    const completed = await this.interviewRepository.completeInterview(
      interviewId,
      employerUserId,
      dto.outcome,
      dto.feedback,
      dto.internalFeedback,
      dto.hiredSalary,
      dto.hiredStartDate ? new Date(dto.hiredStartDate) : undefined,
      dto.contractDetails,
    );

    await this.auditService.log('INTERVIEW_COMPLETED', {
      userId: employerUserId,
      targetUserId: interview.userId,
      ipAddress,
      details: { interviewId, applicationId: interview.applicationId, outcome: dto.outcome },
    });

    return {
      message: 'Interview completed successfully',
      interview: this.sanitizeInterview(completed),
    };
  }

  async listMyInterviews(
    workerUserId: string,
    dto: ListInterviewsDto,
    ipAddress: string,
  ): Promise<InterviewListResponseDto> {
    const result = await this.interviewRepository.listInterviewsForWorker(
      workerUserId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status as InterviewStatus,
    );

    await this.auditService.log('WORKER_INTERVIEWS_LISTED', {
      userId: workerUserId,
      ipAddress,
      details: { count: result.totalCount },
    });

    return {
      items: result.items.map(i => this.sanitizeInterview(i)),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async listVacancyInterviews(
    employerUserId: string,
    vacancyId: string,
    dto: ListVacancyInterviewsDto,
    ipAddress: string,
  ): Promise<InterviewListResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const isOwner = await this.interviewRepository.validateVacancyOwnership(vacancyId, employer.id);
    if (!isOwner) {
      const hasRecruiterAccess = await this.interviewRepository.validateRecruiterAccess(vacancyId, employerUserId);
      if (!hasRecruiterAccess) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Not authorized to view interviews for this vacancy' },
        });
      }
    }

    const result = await this.interviewRepository.listInterviewsForVacancy(
      vacancyId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status as InterviewStatus,
      dto.search,
    );

    await this.auditService.log('EMPLOYER_INTERVIEWS_LISTED', {
      userId: employerUserId,
      ipAddress,
      details: { vacancyId, count: result.totalCount },
    });

    return {
      items: result.items.map(i => this.sanitizeInterview(i)),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async getInterview(workerUserId: string, interviewId: string, ipAddress: string): Promise<InterviewDetailResponseDto> {
    const interview = await this.interviewRepository.findInterviewByIdForWorker(interviewId, workerUserId);
    if (!interview) {
      throw new NotFoundException({
        success: false,
        error: { code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found' },
      });
    }

    await this.auditService.log('INTERVIEW_VIEWED', {
      userId: workerUserId,
      ipAddress,
      details: { interviewId },
    });

    const fullInterview: any = await this.interviewRepository.findInterviewById(interviewId);

    return {
      interview: this.sanitizeInterview(fullInterview),
      schedule: fullInterview?.schedule ? this.sanitizeSchedule(fullInterview.schedule) : undefined,
      application: fullInterview?.application,
      vacancy: fullInterview?.vacancy,
    };
  }

  private sanitizeInterview(interview: any): InterviewResponseDto {
    return {
      id: interview.id,
      applicationId: interview.applicationId,
      vacancyId: interview.vacancyId,
      userId: interview.userId,
      employerId: interview.employerId,
      recruiterId: interview.recruiterId,
      status: interview.status,
      invitedAt: interview.invitedAt,
      respondedAt: interview.respondedAt,
      scheduledAt: interview.scheduledAt,
      completedAt: interview.completedAt,
      mode: interview.mode,
      location: interview.location,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
    };
  }

  private sanitizeSchedule(schedule: any): any {
    return {
      id: schedule.id,
      interviewId: schedule.interviewId,
      scheduledDatetime: schedule.scheduledDatetime,
      durationMinutes: schedule.durationMinutes,
      mode: schedule.mode,
      location: schedule.location,
      meetingLink: schedule.meetingLink,
      employerConfirmed: schedule.employerConfirmed,
      employerConfirmedAt: schedule.employerConfirmedAt,
      workerConfirmed: schedule.workerConfirmed,
      workerConfirmedAt: schedule.workerConfirmedAt,
    };
  }
}
