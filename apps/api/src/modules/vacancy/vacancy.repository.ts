import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, Vacancy, VacancySkill, VacancyRequirement, VacancyVersion, VacancyStatus, BranchStatus } from '@prisma/client';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class VacancyRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findVacancyById(vacancyId: string): Promise<Vacancy | null> {
    return this.prisma.vacancy.findUnique({
      where: { id: vacancyId, deletedAt: null },
      include: {
        skills: { where: { deletedAt: null } },
        requirements: { where: { deletedAt: null } },
      },
    });
  }

  async findVacancyByIdForEmployer(vacancyId: string, employerId: string): Promise<Vacancy | null> {
    return this.prisma.vacancy.findFirst({
      where: { id: vacancyId, employerId, deletedAt: null },
      include: {
        skills: { where: { deletedAt: null } },
        requirements: { where: { deletedAt: null } },
      },
    });
  }

  async listVacanciesForEmployer(
    employerId: string,
    page: number,
    pageSize: number,
    status?: VacancyStatus,
    search?: string,
    locationCity?: string,
  ): Promise<PaginatedResult<Vacancy>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: Prisma.VacancyWhereInput = {
      employerId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      const offset = (page - 1) * enforcedPageSize;

      const statusFilter = status ? Prisma.sql`AND status = CAST(${status} AS "VacancyStatus")` : Prisma.empty;

      const locSearch = locationCity ? `%${locationCity}%` : null;
      const locationFilter = locSearch ? Prisma.sql`AND location_city ILIKE ${locSearch}` : Prisma.empty;

      const baseQuery = Prisma.sql`
        FROM "vacancies"
        WHERE employer_id = CAST(${employerId} AS uuid)
          AND deleted_at IS NULL
          ${statusFilter}
          ${locationFilter}
          AND to_tsvector('simple', coalesce(job_title, '') || ' ' || coalesce(job_code, '') || ' ' || coalesce(job_description, '')) @@ plainto_tsquery('simple', ${search})
      `;

      const [idsResult, countResult] = await Promise.all([
        this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id ${baseQuery}
          ORDER BY created_at DESC, id DESC
          LIMIT ${enforcedPageSize} OFFSET ${offset}
        `,
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count ${baseQuery}
        `
      ]);

      const totalCount = Number(countResult[0]?.count || 0);

      const items = await this.prisma.vacancy.findMany({
        where: { id: { in: idsResult.map(r => r.id) } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          skills: { where: { deletedAt: null } },
          requirements: { where: { deletedAt: null } },
        },
      });

      return {
        items,
        totalCount,
        page,
        pageSize: enforcedPageSize,
        totalPages: Math.ceil(totalCount / enforcedPageSize),
      };
    }

    if (locationCity) {
      where.locationCity = { contains: locationCity, mode: 'insensitive' };
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.vacancy.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          skills: { where: { deletedAt: null } },
          requirements: { where: { deletedAt: null } },
        },
      }),
      this.prisma.vacancy.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async createVacancy(
    employerId: string,
    data: {
      jobTitle: string;
      jobCode: string;
      jobDescription: string;
      jobType: any;
      salaryMin: number;
      salaryMax: number;
      salaryCurrency: string;
      salaryIsNegotiable?: boolean;
      locationAddress?: any;
      locationCity: string;
      locationState: string;
      locationCountry: string;
      isRemote?: boolean;
      remoteType?: any;
      experienceMinYears?: number;
      experienceMaxYears?: number;
      educationMinLevel?: any;
      vacancyCount?: number;
      branchId?: string;
      expiresAt?: Date;
      skills?: any[];
      requirements?: any[];
    },
  ): Promise<Vacancy> {
    return this.prisma.$transaction(async (tx) => {
      const vacancy = await tx.vacancy.create({
        data: {
          employerId,
          jobTitle: data.jobTitle,
          jobCode: data.jobCode,
          jobDescription: data.jobDescription,
          jobType: data.jobType,
          salaryMin: new Prisma.Decimal(data.salaryMin),
          salaryMax: new Prisma.Decimal(data.salaryMax),
          salaryCurrency: data.salaryCurrency,
          salaryIsNegotiable: data.salaryIsNegotiable || false,
          locationAddress: data.locationAddress,
          locationCity: data.locationCity,
          locationState: data.locationState,
          locationCountry: data.locationCountry,
          isRemote: data.isRemote || false,
          remoteType: data.remoteType,
          experienceMinYears: data.experienceMinYears,
          experienceMaxYears: data.experienceMaxYears,
          educationMinLevel: data.educationMinLevel,
          vacancyCount: data.vacancyCount || 1,
          branchId: data.branchId,
          expiresAt: data.expiresAt,
          status: VacancyStatus.DRAFT,
        },
      });

      if (data.skills && data.skills.length > 0) {
        await tx.vacancySkill.createMany({
          data: data.skills.map(s => ({
            vacancyId: vacancy.id,
            skillCode: s.skillCode,
            skillName: s.skillName,
            isRequired: s.isRequired !== false,
            minProficiency: s.minProficiency,
          })),
        });
      }

      if (data.requirements && data.requirements.length > 0) {
        await tx.vacancyRequirement.createMany({
          data: data.requirements.map(r => ({
            vacancyId: vacancy.id,
            requirementType: r.requirementType,
            requirementText: r.requirementText,
            isMandatory: r.isMandatory !== false,
          })),
        });
      }

      return vacancy;
    });
  }

  async updateVacancy(
    vacancyId: string,
    data: {
      jobTitle?: string;
      jobDescription?: string;
      salaryMin?: number;
      salaryMax?: number;
      salaryIsNegotiable?: boolean;
      locationAddress?: any;
      locationCity?: string;
      locationState?: string;
      isRemote?: boolean;
      remoteType?: any;
      experienceMinYears?: number;
      experienceMaxYears?: number;
      educationMinLevel?: any;
      vacancyCount?: number;
      branchId?: string;
      expiresAt?: Date;
      skills?: any[];
      requirements?: any[];
    },
  ): Promise<Vacancy> {
    return this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.VacancyUpdateInput = {};

      if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
      if (data.jobDescription !== undefined) updateData.jobDescription = data.jobDescription;
      if (data.salaryMin !== undefined) updateData.salaryMin = new Prisma.Decimal(data.salaryMin);
      if (data.salaryMax !== undefined) updateData.salaryMax = new Prisma.Decimal(data.salaryMax);
      if (data.salaryIsNegotiable !== undefined) updateData.salaryIsNegotiable = data.salaryIsNegotiable;
      if (data.locationAddress !== undefined) updateData.locationAddress = data.locationAddress;
      if (data.locationCity !== undefined) updateData.locationCity = data.locationCity;
      if (data.locationState !== undefined) updateData.locationState = data.locationState;
      if (data.isRemote !== undefined) updateData.isRemote = data.isRemote;
      if (data.remoteType !== undefined) updateData.remoteType = data.remoteType;
      if (data.experienceMinYears !== undefined) updateData.experienceMinYears = data.experienceMinYears;
      if (data.experienceMaxYears !== undefined) updateData.experienceMaxYears = data.experienceMaxYears;
      if (data.educationMinLevel !== undefined) updateData.educationMinLevel = data.educationMinLevel;
      if (data.vacancyCount !== undefined) updateData.vacancyCount = data.vacancyCount;
      if (data.branchId !== undefined) {
        updateData.branch = data.branchId ? { connect: { id: data.branchId } } : { disconnect: true };
      }
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;

      const vacancy = await tx.vacancy.update({
        where: { id: vacancyId },
        data: updateData,
        include: {
          skills: { where: { deletedAt: null } },
          requirements: { where: { deletedAt: null } },
        },
      });

      if (data.skills !== undefined) {
        await tx.vacancySkill.updateMany({
          where: { vacancyId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        if (data.skills.length > 0) {
          await tx.vacancySkill.createMany({
            data: data.skills.map(s => ({
              vacancyId,
              skillCode: s.skillCode,
              skillName: s.skillName,
              isRequired: s.isRequired !== false,
              minProficiency: s.minProficiency,
            })),
          });
        }
      }

      if (data.requirements !== undefined) {
        await tx.vacancyRequirement.updateMany({
          where: { vacancyId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        if (data.requirements.length > 0) {
          await tx.vacancyRequirement.createMany({
            data: data.requirements.map(r => ({
              vacancyId,
              requirementType: r.requirementType,
              requirementText: r.requirementText,
              isMandatory: r.isMandatory !== false,
            })),
          });
        }
      }

      return vacancy;
    });
  }

  async publishVacancy(vacancyId: string, createdBy: string, changeSummary?: string): Promise<Vacancy> {
    return this.prisma.$transaction(async (tx) => {
      const currentVacancy = await tx.vacancy.findUnique({
        where: { id: vacancyId },
        include: {
          skills: { where: { deletedAt: null } },
          requirements: { where: { deletedAt: null } },
        },
      });

      if (!currentVacancy) {
        throw new Error('VACANCY_NOT_FOUND');
      }

      const currentVersion = await tx.vacancyVersion.findFirst({
        where: { vacancyId, isCurrent: true },
      });
      if (currentVersion) {
        await tx.vacancyVersion.update({
          where: { id: currentVersion.id },
          data: { isCurrent: false },
        });
      }

      const nextVersionNumber = currentVersion ? currentVersion.versionNumber + 1 : 1;

      const snapshotData = {
        jobTitle: currentVacancy.jobTitle,
        jobCode: currentVacancy.jobCode,
        jobDescription: currentVacancy.jobDescription,
        jobType: currentVacancy.jobType,
        salaryMin: currentVacancy.salaryMin.toNumber(),
        salaryMax: currentVacancy.salaryMax.toNumber(),
        salaryCurrency: currentVacancy.salaryCurrency,
        salaryIsNegotiable: currentVacancy.salaryIsNegotiable,
        locationAddress: currentVacancy.locationAddress,
        locationCity: currentVacancy.locationCity,
        locationState: currentVacancy.locationState,
        locationCountry: currentVacancy.locationCountry,
        isRemote: currentVacancy.isRemote,
        remoteType: currentVacancy.remoteType,
        experienceMinYears: currentVacancy.experienceMinYears,
        experienceMaxYears: currentVacancy.experienceMaxYears,
        educationMinLevel: currentVacancy.educationMinLevel,
        vacancyCount: currentVacancy.vacancyCount,
        skills: currentVacancy.skills.map(s => ({
          skillCode: s.skillCode,
          skillName: s.skillName,
          isRequired: s.isRequired,
          minProficiency: s.minProficiency,
        })),
        requirements: currentVacancy.requirements.map(r => ({
          requirementType: r.requirementType,
          requirementText: r.requirementText,
          isMandatory: r.isMandatory,
        })),
      };

      await tx.vacancyVersion.create({
        data: {
          vacancyId,
          versionNumber: nextVersionNumber,
          snapshotData,
          changeSummary,
          isCurrent: true,
          createdBy,
        },
      });

      const vacancy = await tx.vacancy.update({
        where: { id: vacancyId },
        data: {
          status: VacancyStatus.OPEN,
          publishedAt: new Date(),
          currentVersion: nextVersionNumber,
        },
        include: {
          skills: { where: { deletedAt: null } },
          requirements: { where: { deletedAt: null } },
        },
      });

      return vacancy;
    });
  }

  async closeVacancy(vacancyId: string): Promise<Vacancy> {
    return this.prisma.vacancy.update({
      where: { id: vacancyId },
      data: {
        status: VacancyStatus.CLOSED,
        closedAt: new Date(),
      },
      include: {
        skills: { where: { deletedAt: null } },
        requirements: { where: { deletedAt: null } },
      },
    });
  }

  async softDeleteVacancy(vacancyId: string): Promise<void> {
    await this.prisma.vacancy.update({
      where: { id: vacancyId },
      data: { deletedAt: new Date() },
    });
  }

  async getLatestVersion(vacancyId: string): Promise<VacancyVersion | null> {
    return this.prisma.vacancyVersion.findFirst({
      where: { vacancyId, isCurrent: true },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async listVersions(vacancyId: string, page: number, pageSize: number): Promise<PaginatedResult<VacancyVersion>> {
    const enforcedPageSize = Math.min(pageSize, 100);

    const [items, totalCount] = await Promise.all([
      this.prisma.vacancyVersion.findMany({
        where: { vacancyId },
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { versionNumber: 'desc' },
      }),
      this.prisma.vacancyVersion.count({ where: { vacancyId } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async validateBranchOwnership(branchId: string, employerId: string): Promise<boolean> {
    const branch = await this.prisma.employerBranch.findFirst({
      where: { id: branchId, employerId, deletedAt: null, status: BranchStatus.ACTIVE },
    });
    return !!branch;
  }
}
