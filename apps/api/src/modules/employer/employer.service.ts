import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../auth/audit.service';
import { EmployerRepository } from './employer.repository';
import {
  UpdateEmployerProfileDto,
  CreateBranchDto,
  UpdateBranchDto,
  ListBranchesDto,
  CreateRecruiterDto,
  UpdateRecruiterDto,
  ListRecruitersDto,
} from './dto/employer.dto';
import { BranchStatus, RecruiterStatus } from '@prisma/client';

@Injectable()
export class EmployerService {
  constructor(
    private readonly employerRepository: EmployerRepository,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(employerUserId: string, ipAddress: string) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    await this.auditService.log('EMPLOYER_PROFILE_VIEWED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id },
    });

    return this.sanitizeEmployerProfile(employer);
  }

  async updateProfile(
    employerUserId: string,
    dto: UpdateEmployerProfileDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const allowedFields = ['website', 'description'];
    const updateData: { website?: string; description?: string } = {};
    const changes: Record<string, { from: any; to: any }> = {};

    for (const field of allowedFields) {
      if ((dto as any)[field] !== undefined) {
        const oldValue = (employer as any)[field];
        const newValue = (dto as any)[field];
        if (oldValue !== newValue) {
          changes[field] = { from: oldValue, to: newValue };
          updateData[field as keyof typeof updateData] = newValue;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return {
        id: employer.id,
        website: employer.website,
        description: employer.description,
        updatedAt: employer.updatedAt,
      };
    }

    const updated = await this.employerRepository.updateEmployerProfile(employer.id, updateData);

    await this.auditService.log('EMPLOYER_PROFILE_UPDATED', {
      userId: employerUserId,
      targetUserId: employerUserId,
      ipAddress,
      details: {
        employerId: employer.id,
        changes,
      },
    });

    return {
      id: updated.id,
      website: updated.website,
      description: updated.description,
      updatedAt: updated.updatedAt,
    };
  }

  async checkCompliance(employerUserId: string): Promise<{ isCompliant: boolean; reason?: string }> {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      return { isCompliant: false, reason: 'Employer not found' };
    }

    const isVerified = await this.employerRepository.isEmployerVerified(employer.id);
    if (!isVerified) {
      return { isCompliant: false, reason: 'Employer not verified or not active' };
    }

    return { isCompliant: true };
  }

  async verifyCompliance(employerUserId: string): Promise<void> {
    const compliance = await this.checkCompliance(employerUserId);
    if (!compliance.isCompliant) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'NOT_COMPLIANT', message: compliance.reason },
      });
    }
  }

  async listBranches(
    employerUserId: string,
    dto: ListBranchesDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const result = await this.employerRepository.listBranches(
      employer.id,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status,
    );

    await this.auditService.log('EMPLOYER_BRANCHES_LISTED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, count: result.totalCount },
    });

    return {
      items: result.items.map(this.sanitizeBranch),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async createBranch(
    employerUserId: string,
    dto: CreateBranchDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const branch = await this.employerRepository.createBranchInTransaction(employer.id, {
      branchName: dto.branchName,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
      phone: dto.phone,
      isHq: dto.isHq,
    });

    await this.auditService.log('EMPLOYER_BRANCH_CREATED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, branchId: branch.id, branchName: dto.branchName },
    });

    return this.sanitizeBranch(branch);
  }

  async updateBranch(
    employerUserId: string,
    branchId: string,
    dto: UpdateBranchDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const branch = await this.employerRepository.findBranchByIdForEmployer(branchId, employer.id);
    if (!branch) {
      throw new NotFoundException({
        success: false,
        error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found' },
      });
    }

    const changes: Record<string, { from: any; to: any }> = {};
    const updateData: any = {};

    const allowedFields = ['branchName', 'address', 'city', 'state', 'country', 'postalCode', 'phone', 'status', 'isHq'];
    for (const field of allowedFields) {
      if ((dto as any)[field] !== undefined) {
        const oldValue = (branch as any)[field];
        const newValue = (dto as any)[field];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes[field] = { from: oldValue, to: newValue };
          updateData[field] = newValue;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.sanitizeBranch(branch);
    }

    const updated = await this.employerRepository.updateBranchInTransaction(branchId, employer.id, updateData);

    await this.auditService.log('EMPLOYER_BRANCH_UPDATED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, branchId, changes },
    });

    return this.sanitizeBranch(updated);
  }

  async deleteBranch(
    employerUserId: string,
    branchId: string,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const branch = await this.employerRepository.findBranchByIdForEmployer(branchId, employer.id);
    if (!branch) {
      throw new NotFoundException({
        success: false,
        error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found' },
      });
    }

    await this.employerRepository.softDeleteBranch(branchId);

    await this.auditService.log('EMPLOYER_BRANCH_DELETED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, branchId },
    });

    return { message: 'Branch deleted successfully', branchId };
  }

  async listRecruiters(
    employerUserId: string,
    dto: ListRecruitersDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const result = await this.employerRepository.listRecruiters(
      employer.id,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
      dto.status,
    );

    await this.auditService.log('EMPLOYER_RECRUITERS_LISTED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, count: result.totalCount },
    });

    return {
      items: result.items.map(this.sanitizeRecruiter),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async createRecruiter(
    employerUserId: string,
    dto: CreateRecruiterDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    let recruiter;
    try {
      recruiter = await this.employerRepository.createRecruiterInTransaction(employer.id, {
        userId: dto.userId,
        name: dto.name,
        designation: dto.designation,
        department: dto.department,
        phone: dto.phone,
      });
    } catch (error: any) {
      if (error.message?.includes('MAX_RECRUITERS_REACHED')) {
        throw new BadRequestException({
          success: false,
          error: { code: 'MAX_RECRUITERS_REACHED', message: error.message.split(':')[1]?.trim() || 'Maximum recruiters limit reached' },
        });
      }
      if (error.message?.includes('RECRUITER_EXISTS')) {
        throw new BadRequestException({
          success: false,
          error: { code: 'RECRUITER_EXISTS', message: 'User is already a recruiter' },
        });
      }
      throw error;
    }

    await this.auditService.log('EMPLOYER_RECRUITER_CREATED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, recruiterId: recruiter.id, userId: dto.userId },
    });

    return this.sanitizeRecruiter(recruiter);
  }

  async updateRecruiter(
    employerUserId: string,
    recruiterId: string,
    dto: UpdateRecruiterDto,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const recruiter = await this.employerRepository.findRecruiterByIdForEmployer(recruiterId, employer.id);
    if (!recruiter) {
      throw new NotFoundException({
        success: false,
        error: { code: 'RECRUITER_NOT_FOUND', message: 'Recruiter not found' },
      });
    }

    const changes: Record<string, { from: any; to: any }> = {};
    const updateData: any = {};

    const allowedFields = ['name', 'designation', 'department', 'phone', 'status'];
    for (const field of allowedFields) {
      if ((dto as any)[field] !== undefined) {
        const oldValue = (recruiter as any)[field];
        const newValue = (dto as any)[field];
        if (oldValue !== newValue) {
          changes[field] = { from: oldValue, to: newValue };
          updateData[field] = newValue;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.sanitizeRecruiter(recruiter);
    }

    const updated = await this.employerRepository.updateRecruiter(recruiterId, updateData);

    await this.auditService.log('EMPLOYER_RECRUITER_UPDATED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, recruiterId, changes },
    });

    return this.sanitizeRecruiter(updated);
  }

  async deleteRecruiter(
    employerUserId: string,
    recruiterId: string,
    ipAddress: string,
  ) {
    const employer = await this.employerRepository.findEmployerByUserId(employerUserId);
    if (!employer) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EMPLOYER_NOT_FOUND', message: 'Employer profile not found' },
      });
    }

    const recruiter = await this.employerRepository.findRecruiterByIdForEmployer(recruiterId, employer.id);
    if (!recruiter) {
      throw new NotFoundException({
        success: false,
        error: { code: 'RECRUITER_NOT_FOUND', message: 'Recruiter not found' },
      });
    }

    await this.employerRepository.softDeleteRecruiter(recruiterId);

    await this.auditService.log('EMPLOYER_RECRUITER_DELETED', {
      userId: employerUserId,
      ipAddress,
      details: { employerId: employer.id, recruiterId },
    });

    return { message: 'Recruiter deleted successfully', recruiterId };
  }

  private sanitizeEmployerProfile(employer: any) {
    return {
      id: employer.id,
      userId: employer.userId,
      businessRegNo: employer.businessRegNo,
      companyName: employer.companyName,
      legalName: employer.legalName,
      industry: employer.industry,
      companySize: employer.companySize,
      website: employer.website,
      description: employer.description,
      headquartersAddress: employer.headquartersAddress,
      status: employer.status,
      verifiedAt: employer.verifiedAt,
      maxVacancies: employer.maxVacancies,
      maxRecruiters: employer.maxRecruiters,
      createdAt: employer.createdAt,
      updatedAt: employer.updatedAt,
    };
  }

  private sanitizeBranch(branch: any) {
    return {
      id: branch.id,
      employerId: branch.employerId,
      branchName: branch.branchName,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      country: branch.country,
      postalCode: branch.postalCode,
      phone: branch.phone,
      isHq: branch.isHq,
      status: branch.status,
      createdAt: branch.createdAt,
    };
  }

  private sanitizeRecruiter(recruiter: any) {
    return {
      id: recruiter.id,
      employerId: recruiter.employerId,
      userId: recruiter.userId,
      name: recruiter.name,
      designation: recruiter.designation,
      department: recruiter.department,
      phone: recruiter.phone,
      status: recruiter.status,
      createdAt: recruiter.createdAt,
    };
  }
}
