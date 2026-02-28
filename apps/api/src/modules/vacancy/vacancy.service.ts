import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../auth/audit.service';
import { VacancyRepository } from './vacancy.repository';
import { EmployerService } from '../employer/employer.service';
import {
  CreateVacancyDto,
  UpdateVacancyDto,
  ListVacanciesDto,
  PublishVacancyDto,
} from './dto/vacancy.dto';
import { VacancyResponseDto, VacancyListResponseDto, PublishResponseDto, CloseResponseDto, VacancyVersionResponseDto } from './dto/vacancy-response.dto';
import { VacancyStatus } from '@prisma/client';

const VALID_STATUS_TRANSITIONS: Record<VacancyStatus, VacancyStatus[]> = {
  [VacancyStatus.DRAFT]: [VacancyStatus.OPEN],
  [VacancyStatus.OPEN]: [VacancyStatus.CLOSED, VacancyStatus.EXPIRED],
  [VacancyStatus.CLOSED]: [],
  [VacancyStatus.PENDING_REVIEW]: [],
  [VacancyStatus.EXPIRED]: [],
  [VacancyStatus.CANCELLED]: [],
};

@Injectable()
export class VacancyService {
  constructor(
    private readonly vacancyRepository: VacancyRepository,
    private readonly auditService: AuditService,
    private readonly employerService: EmployerService,
  ) {}

  private validateStatusTransition(currentStatus: VacancyStatus, targetStatus: VacancyStatus): void {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition from ${currentStatus} to ${targetStatus}. Valid transitions: ${allowedTransitions.join(', ') || 'none'}`,
        },
      });
    }
  }

  private validateSalary(salaryMin?: number, salaryMax?: number): void {
    if (salaryMin !== undefined && salaryMin < 0) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_SALARY', message: 'salaryMin cannot be negative' },
      });
    }
    if (salaryMax !== undefined && salaryMax < 0) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_SALARY', message: 'salaryMax cannot be negative' },
      });
    }
    if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_SALARY_RANGE', message: 'salaryMin must be less than or equal to salaryMax' },
      });
    }
  }

  async createVacancy(
    employerUserId: string,
    dto: CreateVacancyDto,
    ipAddress: string,
  ): Promise<VacancyResponseDto> {
    await this.employerService.verifyCompliance(employerUserId);

    this.validateSalary(dto.salaryMin, dto.salaryMax);

    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    if (dto.branchId) {
      const isValidBranch = await this.vacancyRepository.validateBranchOwnership(dto.branchId, employer.id);
      if (!isValidBranch) {
        throw new BadRequestException({
          success: false,
          error: { code: 'INVALID_BRANCH', message: 'Branch does not belong to this employer' },
        });
      }
    }

    const vacancy = await this.vacancyRepository.createVacancy(employer.id, {
      jobTitle: dto.jobTitle,
      jobCode: dto.jobCode,
      jobDescription: dto.jobDescription,
      jobType: dto.jobType,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      salaryCurrency: dto.salaryCurrency,
      salaryIsNegotiable: dto.salaryIsNegotiable,
      locationAddress: dto.locationAddress,
      locationCity: dto.locationCity,
      locationState: dto.locationState,
      locationCountry: dto.locationCountry,
      isRemote: dto.isRemote,
      remoteType: dto.remoteType,
      experienceMinYears: dto.experienceMinYears,
      experienceMaxYears: dto.experienceMaxYears,
      educationMinLevel: dto.educationMinLevel,
      vacancyCount: dto.vacancyCount,
      branchId: dto.branchId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      skills: dto.skills,
      requirements: dto.requirements,
    });

    await this.auditService.log('VACANCY_CREATED', {
      userId: employerUserId,
      targetUserId: employerUserId,
      ipAddress,
      details: {
        vacancyId: vacancy.id,
        employerId: employer.id,
        jobTitle: vacancy.jobTitle,
        jobCode: vacancy.jobCode,
      },
    });

    return this.sanitizeVacancy(vacancy);
  }

  async getVacancy(
    employerUserId: string,
    vacancyId: string,
    ipAddress: string,
  ): Promise<VacancyResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const vacancy = await this.vacancyRepository.findVacancyByIdForEmployer(vacancyId, employer.id);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    await this.auditService.log('VACANCY_VIEWED', {
      userId: employerUserId,
      ipAddress,
      details: { vacancyId, employerId: employer.id },
    });

    return this.sanitizeVacancy(vacancy);
  }

  async listVacancies(
    employerUserId: string,
    dto: ListVacanciesDto,
    ipAddress: string,
  ): Promise<VacancyListResponseDto> {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const result = await this.vacancyRepository.listVacanciesForEmployer(
      employer.id,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status,
      dto.search,
      dto.locationCity,
    );

    await this.auditService.log('VACANCIES_LISTED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, count: result.totalCount },
    });

    return {
      items: result.items.map(v => this.sanitizeVacancy(v)),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async updateVacancy(
    employerUserId: string,
    vacancyId: string,
    dto: UpdateVacancyDto,
    ipAddress: string,
  ): Promise<VacancyResponseDto> {
    await this.employerService.verifyCompliance(employerUserId);

    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const vacancy = await this.vacancyRepository.findVacancyByIdForEmployer(vacancyId, employer.id);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    this.validateStatusTransition(vacancy.status, VacancyStatus.DRAFT);

    if (dto.salaryMin !== undefined || dto.salaryMax !== undefined) {
      this.validateSalary(
        dto.salaryMin ?? vacancy.salaryMin.toNumber(),
        dto.salaryMax ?? vacancy.salaryMax.toNumber(),
      );
    }

    if (dto.branchId && dto.branchId !== vacancy.branchId) {
      const isValidBranch = await this.vacancyRepository.validateBranchOwnership(dto.branchId, employer.id);
      if (!isValidBranch) {
        throw new BadRequestException({
          success: false,
          error: { code: 'INVALID_BRANCH', message: 'Branch does not belong to this employer' },
        });
      }
    }

    const updated = await this.vacancyRepository.updateVacancy(vacancyId, {
      jobTitle: dto.jobTitle,
      jobDescription: dto.jobDescription,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      salaryIsNegotiable: dto.salaryIsNegotiable,
      locationAddress: dto.locationAddress,
      locationCity: dto.locationCity,
      locationState: dto.locationState,
      isRemote: dto.isRemote,
      remoteType: dto.remoteType,
      experienceMinYears: dto.experienceMinYears,
      experienceMaxYears: dto.experienceMaxYears,
      educationMinLevel: dto.educationMinLevel,
      vacancyCount: dto.vacancyCount,
      branchId: dto.branchId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      skills: dto.skills,
      requirements: dto.requirements,
    });

    await this.auditService.log('VACANCY_UPDATED', {
      userId: employerUserId,
      ipAddress,
      details: {
        vacancyId,
        employerId: employer.id,
        jobTitle: dto.jobTitle,
      },
    });

    return this.sanitizeVacancy(updated);
  }

  async publishVacancy(
    employerUserId: string,
    vacancyId: string,
    dto: PublishVacancyDto,
    ipAddress: string,
  ): Promise<PublishResponseDto> {
    await this.employerService.verifyCompliance(employerUserId);

    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const vacancy = await this.vacancyRepository.findVacancyByIdForEmployer(vacancyId, employer.id);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    this.validateStatusTransition(vacancy.status, VacancyStatus.OPEN);

    if (vacancy.status === VacancyStatus.OPEN) {
      throw new BadRequestException({
        success: false,
        error: { code: 'ALREADY_PUBLISHED', message: 'Vacancy is already published' },
      });
    }

    const published = await this.vacancyRepository.publishVacancy(vacancyId, employerUserId, dto.changeSummary);

    await this.auditService.log('VACANCY_PUBLISHED', {
      userId: employerUserId,
      targetUserId: employerUserId,
      ipAddress,
      details: {
        vacancyId,
        employerId: employer.id,
        jobTitle: vacancy.jobTitle,
        version: published.currentVersion,
      },
    });

    return {
      message: 'Vacancy published successfully',
      vacancy: this.sanitizeVacancy(published),
      versionNumber: published.currentVersion,
    };
  }

  async closeVacancy(
    employerUserId: string,
    vacancyId: string,
    ipAddress: string,
  ): Promise<CloseResponseDto> {
    await this.employerService.verifyCompliance(employerUserId);

    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const vacancy = await this.vacancyRepository.findVacancyByIdForEmployer(vacancyId, employer.id);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    this.validateStatusTransition(vacancy.status, VacancyStatus.CLOSED);

    const closed = await this.vacancyRepository.closeVacancy(vacancyId);

    await this.auditService.log('VACANCY_CLOSED', {
      userId: employerUserId,
      ipAddress,
      details: {
        vacancyId,
        employerId: employer.id,
        jobTitle: vacancy.jobTitle,
      },
    });

    return {
      message: 'Vacancy closed successfully',
      vacancy: this.sanitizeVacancy(closed),
    };
  }

  async deleteVacancy(
    employerUserId: string,
    vacancyId: string,
    ipAddress: string,
  ): Promise<{ message: string; vacancyId: string }> {
    await this.employerService.verifyCompliance(employerUserId);

    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const vacancy = await this.vacancyRepository.findVacancyByIdForEmployer(vacancyId, employer.id);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    if (vacancy.status !== VacancyStatus.DRAFT) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only draft vacancies can be deleted' },
      });
    }

    await this.vacancyRepository.softDeleteVacancy(vacancyId);

    await this.auditService.log('VACANCY_DELETED', {
      userId: employerUserId,
      ipAddress,
      details: {
        vacancyId,
        employerId: employer.id,
        jobTitle: vacancy.jobTitle,
      },
    });

    return { message: 'Vacancy deleted successfully', vacancyId };
  }

  async getVersions(
    employerUserId: string,
    vacancyId: string,
    page: number,
    pageSize: number,
    ipAddress: string,
  ) {
    const employer = await this.employerService.getProfile(employerUserId, ipAddress);

    const vacancy = await this.vacancyRepository.findVacancyByIdForEmployer(vacancyId, employer.id);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    const result = await this.vacancyRepository.listVersions(
      vacancyId,
      Math.max(1, page || 1),
      Math.min(pageSize || 20, 100),
    );

    await this.auditService.log('VACANCY_VERSIONS_LISTED', {
      userId: employerUserId,
      ipAddress,
      details: { vacancyId, employerId: employer.id, count: result.totalCount },
    });

    return {
      items: result.items.map(v => this.sanitizeVersion(v)),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  private sanitizeVacancy(vacancy: any): VacancyResponseDto {
    return {
      id: vacancy.id,
      employerId: vacancy.employerId,
      branchId: vacancy.branchId,
      jobTitle: vacancy.jobTitle,
      jobCode: vacancy.jobCode,
      jobDescription: vacancy.jobDescription,
      jobType: vacancy.jobType,
      salaryMin: vacancy.salaryMin?.toNumber?.() ?? vacancy.salaryMin,
      salaryMax: vacancy.salaryMax?.toNumber?.() ?? vacancy.salaryMax,
      salaryCurrency: vacancy.salaryCurrency,
      salaryIsNegotiable: vacancy.salaryIsNegotiable,
      locationAddress: vacancy.locationAddress,
      locationCity: vacancy.locationCity,
      locationState: vacancy.locationState,
      locationCountry: vacancy.locationCountry,
      isRemote: vacancy.isRemote,
      remoteType: vacancy.remoteType,
      experienceMinYears: vacancy.experienceMinYears,
      experienceMaxYears: vacancy.experienceMaxYears,
      educationMinLevel: vacancy.educationMinLevel,
      vacancyCount: vacancy.vacancyCount,
      currentVersion: vacancy.currentVersion,
      status: vacancy.status,
      expiresAt: vacancy.expiresAt,
      publishedAt: vacancy.publishedAt,
      closedAt: vacancy.closedAt,
      complianceStatus: vacancy.complianceStatus,
      complianceNotes: vacancy.complianceNotes,
      viewCount: vacancy.viewCount,
      applicationCount: vacancy.applicationCount,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
    };
  }

  private sanitizeVersion(version: any): VacancyVersionResponseDto {
    return {
      id: version.id,
      vacancyId: version.vacancyId,
      versionNumber: version.versionNumber,
      snapshotData: version.snapshotData,
      changeSummary: version.changeSummary,
      isCurrent: version.isCurrent,
      createdBy: version.createdBy,
      createdAt: version.createdAt,
    };
  }
}
