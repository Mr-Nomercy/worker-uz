import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, WorkerProfile, WorkerEducation, WorkerExperience, WorkerSkill, CvSnapshot, User } from '@prisma/client';
import * as crypto from 'crypto';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function computeHash(data: any, previousHash?: string): string {
  const payload = stableStringify(data) + (previousHash || '');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

@Injectable()
export class WorkerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWorkerProfileByUserId(userId: string): Promise<WorkerProfile | null> {
    return this.prisma.workerProfile.findUnique({
      where: { userId, deletedAt: null },
    });
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
  }

  async updateUserContact(userId: string, data: { phone?: string }): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: data.phone,
      },
    });
  }

  async listEducation(userId: string, page: number, pageSize: number): Promise<PaginatedResult<WorkerEducation>> {
    const [items, totalCount] = await Promise.all([
      this.prisma.workerEducation.findMany({
        where: { userId, deletedAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.workerEducation.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async findEducationById(educationId: string): Promise<WorkerEducation | null> {
    return this.prisma.workerEducation.findUnique({
      where: { id: educationId },
    });
  }

  async createEducation(userId: string, data: {
    institutionName: string;
    institutionCode: string;
    degree: string;
    fieldOfStudy: string;
    startDate: Date;
    endDate?: Date;
    gradeGpa?: number;
    gradeScale?: number;
  }): Promise<WorkerEducation> {
    return this.prisma.workerEducation.create({
      data: {
        userId,
        institutionName: data.institutionName,
        institutionCode: data.institutionCode,
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy,
        startDate: data.startDate,
        endDate: data.endDate,
        gradeGpa: data.gradeGpa ? new Prisma.Decimal(data.gradeGpa) : undefined,
        gradeScale: data.gradeScale ? new Prisma.Decimal(data.gradeScale) : undefined,
        sourceSystem: 'WORKER_SELF_REPORTED',
      },
    });
  }

  async updateEducation(educationId: string, data: {
    institutionName?: string;
    institutionCode?: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: Date;
    endDate?: Date;
    gradeGpa?: number;
    gradeScale?: number;
  }): Promise<WorkerEducation> {
    const updateData: Prisma.WorkerEducationUpdateInput = {};
    if (data.institutionName !== undefined) updateData.institutionName = data.institutionName;
    if (data.institutionCode !== undefined) updateData.institutionCode = data.institutionCode;
    if (data.degree !== undefined) updateData.degree = data.degree;
    if (data.fieldOfStudy !== undefined) updateData.fieldOfStudy = data.fieldOfStudy;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.gradeGpa !== undefined) updateData.gradeGpa = new Prisma.Decimal(data.gradeGpa);
    if (data.gradeScale !== undefined) updateData.gradeScale = new Prisma.Decimal(data.gradeScale);

    return this.prisma.workerEducation.update({
      where: { id: educationId },
      data: updateData,
    });
  }

  async softDeleteEducation(educationId: string): Promise<void> {
    await this.prisma.workerEducation.update({
      where: { id: educationId },
      data: { deletedAt: new Date() },
    });
  }

  async listExperience(userId: string, page: number, pageSize: number): Promise<PaginatedResult<WorkerExperience>> {
    const [items, totalCount] = await Promise.all([
      this.prisma.workerExperience.findMany({
        where: { userId, deletedAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.workerExperience.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async findExperienceById(experienceId: string): Promise<WorkerExperience | null> {
    return this.prisma.workerExperience.findUnique({
      where: { id: experienceId },
    });
  }

  async createExperience(userId: string, data: {
    employerName: string;
    employerRegNo?: string;
    jobTitle: string;
    jobType: any;
    startDate: Date;
    endDate?: Date;
    salary?: number;
    currency?: string;
    reasonForLeaving?: string;
  }): Promise<WorkerExperience> {
    return this.prisma.workerExperience.create({
      data: {
        userId,
        employerName: data.employerName,
        employerRegNo: data.employerRegNo,
        jobTitle: data.jobTitle,
        jobType: data.jobType,
        startDate: data.startDate,
        endDate: data.endDate,
        salary: data.salary ? new Prisma.Decimal(data.salary) : undefined,
        currency: data.currency,
        reasonForLeaving: data.reasonForLeaving,
        sourceSystem: 'WORKER_SELF_REPORTED',
      },
    });
  }

  async updateExperience(experienceId: string, data: {
    employerName?: string;
    employerRegNo?: string;
    jobTitle?: string;
    jobType?: any;
    startDate?: Date;
    endDate?: Date;
    salary?: number;
    currency?: string;
    reasonForLeaving?: string;
  }): Promise<WorkerExperience> {
    const updateData: Prisma.WorkerExperienceUpdateInput = {};
    if (data.employerName !== undefined) updateData.employerName = data.employerName;
    if (data.employerRegNo !== undefined) updateData.employerRegNo = data.employerRegNo;
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
    if (data.jobType !== undefined) updateData.jobType = data.jobType;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.salary !== undefined) updateData.salary = new Prisma.Decimal(data.salary);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.reasonForLeaving !== undefined) updateData.reasonForLeaving = data.reasonForLeaving;

    return this.prisma.workerExperience.update({
      where: { id: experienceId },
      data: updateData,
    });
  }

  async softDeleteExperience(experienceId: string): Promise<void> {
    await this.prisma.workerExperience.update({
      where: { id: experienceId },
      data: { deletedAt: new Date() },
    });
  }

  async listSkills(userId: string, page: number, pageSize: number): Promise<PaginatedResult<WorkerSkill>> {
    const [items, totalCount] = await Promise.all([
      this.prisma.workerSkill.findMany({
        where: { userId, deletedAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { skillName: 'asc' },
      }),
      this.prisma.workerSkill.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async findSkillById(skillId: string): Promise<WorkerSkill | null> {
    return this.prisma.workerSkill.findUnique({
      where: { id: skillId },
    });
  }

  async createSkill(userId: string, data: {
    skillCode: string;
    skillName: string;
    proficiencyLevel: any;
    yearsExperience: number;
  }): Promise<WorkerSkill> {
    return this.prisma.workerSkill.create({
      data: {
        userId,
        skillCode: data.skillCode.toUpperCase(),
        skillName: data.skillName,
        proficiencyLevel: data.proficiencyLevel,
        yearsExperience: data.yearsExperience,
      },
    });
  }

  async updateSkill(skillId: string, data: {
    skillCode?: string;
    skillName?: string;
    proficiencyLevel?: any;
    yearsExperience?: number;
  }): Promise<WorkerSkill> {
    const updateData: Prisma.WorkerSkillUpdateInput = {};
    if (data.skillCode !== undefined) updateData.skillCode = data.skillCode.toUpperCase();
    if (data.skillName !== undefined) updateData.skillName = data.skillName;
    if (data.proficiencyLevel !== undefined) updateData.proficiencyLevel = data.proficiencyLevel;
    if (data.yearsExperience !== undefined) updateData.yearsExperience = data.yearsExperience;

    return this.prisma.workerSkill.update({
      where: { id: skillId },
      data: updateData,
    });
  }

  async softDeleteSkill(skillId: string): Promise<void> {
    await this.prisma.workerSkill.update({
      where: { id: skillId },
      data: { deletedAt: new Date() },
    });
  }

  async getCurrentSnapshot(userId: string): Promise<CvSnapshot | null> {
    return this.prisma.cvSnapshot.findFirst({
      where: { userId, isCurrent: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSnapshots(userId: string, page: number, pageSize: number): Promise<PaginatedResult<CvSnapshot>> {
    const [items, totalCount] = await Promise.all([
      this.prisma.cvSnapshot.findMany({
        where: { userId, deletedAt: null },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cvSnapshot.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async atomicCreateSnapshotWithEducation(
    userId: string,
    educationData: any,
    sourceApi: string,
  ): Promise<{ snapshot: CvSnapshot | null; isDuplicate: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const currentSnapshot = await tx.cvSnapshot.findFirst({
        where: { userId, isCurrent: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      const nextVersion = currentSnapshot ? currentSnapshot.snapshotVersion + 1 : 1;

      const education = await tx.workerEducation.findMany({
        where: { userId, deletedAt: null },
        orderBy: { startDate: 'desc' },
      });

      const snapshotData = {
        education: education.map(e => ({
          id: e.id,
          institutionName: e.institutionName,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate?.toISOString() || null,
          gradeGpa: e.gradeGpa?.toNumber() || null,
        })),
      };

      const previousHash = currentSnapshot?.sha256Hash;
      const sha256Hash = computeHash(snapshotData, previousHash);

      if (currentSnapshot && sha256Hash === currentSnapshot.sha256Hash) {
        return { snapshot: currentSnapshot, isDuplicate: true };
      }

      if (currentSnapshot) {
        await tx.cvSnapshot.update({
          where: { id: currentSnapshot.id },
          data: { isCurrent: false },
        });
      }

      const snapshot = await tx.cvSnapshot.create({
        data: {
          userId,
          snapshotVersion: nextVersion,
          snapshotData,
          sha256Hash,
          previousHash: previousHash || null,
          sourceApi,
          isCurrent: true,
        },
      });

      return { snapshot, isDuplicate: false };
    });
  }

  async atomicCreateSnapshotWithExperience(
    userId: string,
    experienceData: any,
    sourceApi: string,
  ): Promise<{ snapshot: CvSnapshot | null; isDuplicate: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const currentSnapshot = await tx.cvSnapshot.findFirst({
        where: { userId, isCurrent: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      const nextVersion = currentSnapshot ? currentSnapshot.snapshotVersion + 1 : 1;

      const [education, experience, skills] = await Promise.all([
        tx.workerEducation.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: 'desc' } }),
        tx.workerExperience.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: 'desc' } }),
        tx.workerSkill.findMany({ where: { userId, deletedAt: null } }),
      ]);

      const snapshotData = {
        education: education.map(e => ({
          id: e.id,
          institutionName: e.institutionName,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate?.toISOString() || null,
          gradeGpa: e.gradeGpa?.toNumber() || null,
        })),
        experience: experience.map(exp => ({
          id: exp.id,
          employerName: exp.employerName,
          jobTitle: exp.jobTitle,
          jobType: exp.jobType,
          startDate: exp.startDate.toISOString(),
          endDate: exp.endDate?.toISOString() || null,
        })),
        skills: skills.map(s => ({
          id: s.id,
          skillCode: s.skillCode,
          skillName: s.skillName,
          proficiencyLevel: s.proficiencyLevel,
        })),
      };

      const previousHash = currentSnapshot?.sha256Hash;
      const sha256Hash = computeHash(snapshotData, previousHash);

      if (currentSnapshot && sha256Hash === currentSnapshot.sha256Hash) {
        return { snapshot: currentSnapshot, isDuplicate: true };
      }

      if (currentSnapshot) {
        await tx.cvSnapshot.update({
          where: { id: currentSnapshot.id },
          data: { isCurrent: false },
        });
      }

      const snapshot = await tx.cvSnapshot.create({
        data: {
          userId,
          snapshotVersion: nextVersion,
          snapshotData,
          sha256Hash,
          previousHash: previousHash || null,
          sourceApi,
          isCurrent: true,
        },
      });

      return { snapshot, isDuplicate: false };
    });
  }

  async atomicCreateSnapshotForUser(userId: string, sourceApi: string): Promise<{ snapshot: CvSnapshot | null; isDuplicate: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const currentSnapshot = await tx.cvSnapshot.findFirst({
        where: { userId, isCurrent: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      const nextVersion = currentSnapshot ? currentSnapshot.snapshotVersion + 1 : 1;

      const [profile, education, experience, skills] = await Promise.all([
        tx.workerProfile.findUnique({ where: { userId } }),
        tx.workerEducation.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: 'desc' } }),
        tx.workerExperience.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: 'desc' } }),
        tx.workerSkill.findMany({ where: { userId, deletedAt: null } }),
      ]);

      const snapshotData = {
        profile: profile ? {
          fullName: profile.fullName,
          gender: profile.gender,
          permanentAddress: profile.permanentAddress,
          currentAddress: profile.currentAddress,
        } : null,
        education: education.map(e => ({
          id: e.id,
          institutionName: e.institutionName,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate?.toISOString() || null,
          gradeGpa: e.gradeGpa?.toNumber() || null,
        })),
        experience: experience.map(exp => ({
          id: exp.id,
          employerName: exp.employerName,
          jobTitle: exp.jobTitle,
          jobType: exp.jobType,
          startDate: exp.startDate.toISOString(),
          endDate: exp.endDate?.toISOString() || null,
        })),
        skills: skills.map(s => ({
          id: s.id,
          skillCode: s.skillCode,
          skillName: s.skillName,
          proficiencyLevel: s.proficiencyLevel,
        })),
      };

      const previousHash = currentSnapshot?.sha256Hash;
      const sha256Hash = computeHash(snapshotData, previousHash);

      if (currentSnapshot && sha256Hash === currentSnapshot.sha256Hash) {
        return { snapshot: currentSnapshot, isDuplicate: true };
      }

      if (currentSnapshot) {
        await tx.cvSnapshot.update({
          where: { id: currentSnapshot.id },
          data: { isCurrent: false },
        });
      }

      const snapshot = await tx.cvSnapshot.create({
        data: {
          userId,
          snapshotVersion: nextVersion,
          snapshotData,
          sha256Hash,
          previousHash: previousHash || null,
          sourceApi,
          isCurrent: true,
        },
      });

      return { snapshot, isDuplicate: false };
    });
  }

  async findWorkerProfileForEmployer(workerId: string): Promise<(WorkerProfile & { user: User }) | null> {
    return this.prisma.workerProfile.findUnique({
      where: { userId: workerId, deletedAt: null },
      include: { user: true },
    });
  }

  async findCurrentSnapshotForEmployer(workerId: string): Promise<CvSnapshot | null> {
    return this.prisma.cvSnapshot.findFirst({
      where: { userId: workerId, isCurrent: true, deletedAt: null },
    });
  }
}
