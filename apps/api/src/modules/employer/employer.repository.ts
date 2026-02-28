import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, Employer, EmployerBranch, Recruiter, EmployerStatus, BranchStatus, RecruiterStatus } from '@prisma/client';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ALLOWED_PROFILE_FIELDS = ['website', 'description'] as const;
type AllowedProfileField = typeof ALLOWED_PROFILE_FIELDS[number];

@Injectable()
export class EmployerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEmployerByUserId(userId: string): Promise<Employer | null> {
    return this.prisma.employer.findUnique({
      where: { userId, deletedAt: null },
      include: {
        branches: { where: { deletedAt: null } },
        recruiters: { where: { deletedAt: null } },
      },
    });
  }

  async findEmployerById(employerId: string): Promise<Employer | null> {
    return this.prisma.employer.findUnique({
      where: { id: employerId, deletedAt: null },
    });
  }

  async updateEmployerProfile(
    employerId: string,
    data: { website?: string; description?: string },
  ): Promise<Employer> {
    const updateData: Prisma.EmployerUpdateInput = {};
    if (data.website !== undefined) updateData.website = data.website;
    if (data.description !== undefined) updateData.description = data.description;

    return this.prisma.employer.update({
      where: { id: employerId },
      data: updateData,
    });
  }

  async getEmployerForUpdate(employerId: string): Promise<Employer | null> {
    return this.prisma.employer.findUnique({
      where: { id: employerId },
    });
  }

  async isEmployerVerified(employerId: string): Promise<boolean> {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      select: { status: true, verifiedAt: true },
    });
    return employer?.status === EmployerStatus.ACTIVE && employer?.verifiedAt !== null;
  }

  async listBranches(
    employerId: string,
    page: number,
    pageSize: number,
    status?: BranchStatus,
  ): Promise<PaginatedResult<EmployerBranch>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.EmployerBranchWhereInput = {
      employerId,
      deletedAt: null,
    };
    if (status) {
      where.status = status;
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.employerBranch.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employerBranch.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async findBranchByIdForEmployer(branchId: string, employerId: string): Promise<EmployerBranch | null> {
    return this.prisma.employerBranch.findFirst({
      where: { id: branchId, employerId, deletedAt: null },
    });
  }

  async createBranchInTransaction(
    employerId: string,
    data: {
      branchName: string;
      address: any;
      city: string;
      state: string;
      country: string;
      postalCode?: string;
      phone?: string;
      isHq?: boolean;
    },
  ): Promise<EmployerBranch> {
    return this.prisma.$transaction(async (tx) => {
      if (data.isHq) {
        await tx.employerBranch.updateMany({
          where: { employerId, isHq: true, deletedAt: null },
          data: { isHq: false },
        });
      }

      return tx.employerBranch.create({
        data: {
          employerId,
          branchName: data.branchName,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          phone: data.phone,
          isHq: data.isHq || false,
        },
      });
    });
  }

  async updateBranchInTransaction(
    branchId: string,
    employerId: string,
    data: {
      branchName?: string;
      address?: any;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      phone?: string;
      status?: BranchStatus;
      isHq?: boolean;
    },
  ): Promise<EmployerBranch> {
    return this.prisma.$transaction(async (tx) => {
      if (data.isHq === true) {
        await tx.employerBranch.updateMany({
          where: { employerId, isHq: true, deletedAt: null, id: { not: branchId } },
          data: { isHq: false },
        });
      }

      const updateData: Prisma.EmployerBranchUpdateInput = {};
      if (data.branchName !== undefined) updateData.branchName = data.branchName;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.city !== undefined) updateData.city = data.city;
      if (data.state !== undefined) updateData.state = data.state;
      if (data.country !== undefined) updateData.country = data.country;
      if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.isHq !== undefined) updateData.isHq = data.isHq;

      return tx.employerBranch.update({
        where: { id: branchId },
        data: updateData,
      });
    });
  }

  async softDeleteBranch(branchId: string): Promise<void> {
    await this.prisma.employerBranch.update({
      where: { id: branchId },
      data: { deletedAt: new Date() },
    });
  }

  async countRecruiters(employerId: string): Promise<number> {
    return this.prisma.recruiter.count({
      where: { employerId, deletedAt: null },
    });
  }

  async countMaxRecruiters(employerId: string): Promise<number> {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      select: { maxRecruiters: true },
    });
    return employer?.maxRecruiters || 0;
  }

  async listRecruiters(
    employerId: string,
    page: number,
    pageSize: number,
    status?: RecruiterStatus,
  ): Promise<PaginatedResult<Recruiter>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.RecruiterWhereInput = {
      employerId,
      deletedAt: null,
    };
    if (status) {
      where.status = status;
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.recruiter.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recruiter.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async findRecruiterByIdForEmployer(recruiterId: string, employerId: string): Promise<Recruiter | null> {
    return this.prisma.recruiter.findFirst({
      where: { id: recruiterId, employerId, deletedAt: null },
    });
  }

  async findRecruiterByUserId(userId: string): Promise<Recruiter | null> {
    return this.prisma.recruiter.findUnique({
      where: { userId, deletedAt: null },
    });
  }

  async createRecruiterInTransaction(
    employerId: string,
    data: {
      userId: string;
      name: string;
      designation?: string;
      department?: string;
      phone?: string;
    },
  ): Promise<Recruiter> {
    return this.prisma.$transaction(async (tx) => {
      const [currentCount, employer] = await Promise.all([
        tx.recruiter.count({ where: { employerId, deletedAt: null } }),
        tx.employer.findUnique({ where: { id: employerId }, select: { maxRecruiters: true } }),
      ]);

      const maxRecruiters = employer?.maxRecruiters || 0;
      if (currentCount >= maxRecruiters) {
        throw new Error(`MAX_RECRUITERS_REACHED: Maximum recruiters limit (${maxRecruiters}) reached`);
      }

      const existingRecruiter = await tx.recruiter.findUnique({
        where: { userId: data.userId },
      });
      if (existingRecruiter && existingRecruiter.deletedAt === null) {
        throw new Error('RECRUITER_EXISTS: User is already a recruiter');
      }

      if (existingRecruiter && existingRecruiter.deletedAt !== null) {
        return tx.recruiter.update({
          where: { id: existingRecruiter.id },
          data: {
            employerId,
            name: data.name,
            designation: data.designation,
            department: data.department,
            phone: data.phone,
            deletedAt: null,
          },
        });
      }

      return tx.recruiter.create({
        data: {
          employerId,
          userId: data.userId,
          name: data.name,
          designation: data.designation,
          department: data.department,
          phone: data.phone,
        },
      });
    });
  }

  async updateRecruiter(
    recruiterId: string,
    data: {
      name?: string;
      designation?: string;
      department?: string;
      phone?: string;
      status?: RecruiterStatus;
    },
  ): Promise<Recruiter> {
    const updateData: Prisma.RecruiterUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.recruiter.update({
      where: { id: recruiterId },
      data: updateData,
    });
  }

  async softDeleteRecruiter(recruiterId: string): Promise<void> {
    await this.prisma.recruiter.update({
      where: { id: recruiterId },
      data: { deletedAt: new Date() },
    });
  }

  async getEmployerIdByUserId(userId: string): Promise<string | null> {
    const employer = await this.prisma.employer.findUnique({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return employer?.id || null;
  }
}
