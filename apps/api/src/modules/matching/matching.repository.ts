import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, MatchScore } from '@prisma/client';

const CONCURRENCY_LIMIT = 20;

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ScoreComponents {
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  salaryScore: number;
  totalScore: number;
  skillMatchCount: number;
  skillRequiredCount: number;
  isRecommended: boolean;
}

@Injectable()
export class MatchingRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findMatchScore(workerId: string, vacancyId: string): Promise<MatchScore | null> {
    return this.prisma.matchScore.findUnique({
      where: {
        workerId_vacancyId: { workerId, vacancyId },
      },
    });
  }

  async upsertMatchScore(data: {
    workerId: string;
    vacancyId: string;
    totalScore: number;
    skillScore: number;
    experienceScore: number;
    educationScore: number;
    locationScore: number;
    salaryScore: number;
    skillMatchCount: number;
    skillRequiredCount: number;
    isRecommended: boolean;
  }): Promise<MatchScore> {
    return this.prisma.matchScore.upsert({
      where: {
        workerId_vacancyId: { workerId: data.workerId, vacancyId: data.vacancyId },
      },
      create: {
        workerId: data.workerId,
        vacancyId: data.vacancyId,
        totalScore: data.totalScore,
        skillScore: data.skillScore,
        experienceScore: data.experienceScore,
        educationScore: data.educationScore,
        locationScore: data.locationScore,
        salaryScore: data.salaryScore,
        skillMatchCount: data.skillMatchCount,
        skillRequiredCount: data.skillRequiredCount,
        isRecommended: data.isRecommended,
      },
      update: {
        totalScore: data.totalScore,
        skillScore: data.skillScore,
        experienceScore: data.experienceScore,
        educationScore: data.educationScore,
        locationScore: data.locationScore,
        salaryScore: data.salaryScore,
        skillMatchCount: data.skillMatchCount,
        skillRequiredCount: data.skillRequiredCount,
        isRecommended: data.isRecommended,
        calculatedAt: new Date(),
      },
    });
  }

  async getWorkerSkills(workerId: string): Promise<any[]> {
    return this.prisma.workerSkill.findMany({
      where: { userId: workerId, deletedAt: null },
    });
  }

  async getWorkerEducation(workerId: string): Promise<any[]> {
    return this.prisma.workerEducation.findMany({
      where: { userId: workerId, deletedAt: null },
    });
  }

  async getWorkerExperience(workerId: string): Promise<any[]> {
    return this.prisma.workerExperience.findMany({
      where: { userId: workerId, deletedAt: null },
    });
  }

  async getVacancySkills(vacancyId: string): Promise<any[]> {
    return this.prisma.vacancySkill.findMany({
      where: { vacancyId, deletedAt: null },
    });
  }

  async getVacancy(vacancyId: string): Promise<any> {
    return this.prisma.vacancy.findUnique({
      where: { id: vacancyId, deletedAt: null },
    });
  }

  async getWorkerProfile(workerId: string): Promise<any> {
    return this.prisma.workerProfile.findUnique({
      where: { userId: workerId },
    });
  }

  async getActiveVacanciesForWorker(workerId: string, page: number, pageSize: number): Promise<PaginatedResult<any>> {
    const enforcedPageSize = Math.min(pageSize, 200);

    const [items, totalCount] = await Promise.all([
      this.prisma.vacancy.findMany({
        where: { status: 'OPEN', deletedAt: null },
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.vacancy.count({ where: { status: 'OPEN', deletedAt: null } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async getActiveWorkersForVacancy(vacancyId: string, page: number, pageSize: number): Promise<PaginatedResult<any>> {
    const enforcedPageSize = Math.min(pageSize, 200);

    const [items, totalCount] = await Promise.all([
      this.prisma.workerProfile.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workerProfile.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  async getRecommendedMatches(vacancyId: string, limit: number = 20): Promise<MatchScore[]> {
    return this.prisma.matchScore.findMany({
      where: {
        vacancyId,
        isRecommended: true,
      },
      orderBy: { totalScore: 'desc' },
      take: limit,
    });
  }

  async getWorkerMatches(workerId: string, limit: number = 20): Promise<MatchScore[]> {
    return this.prisma.matchScore.findMany({
      where: {
        workerId,
      },
      orderBy: { totalScore: 'desc' },
      take: limit,
    });
  }

  async recalculateBatchForWorker(workerId: string, vacancyIds: string[]): Promise<number> {
    const workerSkills = await this.getWorkerSkills(workerId);
    const workerEducation = await this.getWorkerEducation(workerId);
    const workerExperience = await this.getWorkerExperience(workerId);
    const workerProfile = await this.getWorkerProfile(workerId);

    const vacancies = await this.prisma.vacancy.findMany({
      where: {
        id: { in: vacancyIds },
        deletedAt: null,
      },
    });

    const vacancySkills = await this.prisma.vacancySkill.findMany({
      where: {
        vacancyId: { in: vacancyIds },
        deletedAt: null,
      },
    });

    const vacancyMap = new Map(vacancies.map(v => [v.id, v]));
    const vacancySkillsMap = new Map<string, any[]>();

    for (const skill of vacancySkills) {
      if (!vacancySkillsMap.has(skill.vacancyId)) {
        vacancySkillsMap.set(skill.vacancyId, []);
      }
      vacancySkillsMap.get(skill.vacancyId)!.push(skill);
    }

    const processVacancy = async (vacancyId: string): Promise<number> => {
      const vacancy = vacancyMap.get(vacancyId);
      if (!vacancy) return 0;

      const vSkills = vacancySkillsMap.get(vacancyId) || [];

      const scores = this.calculateScoreComponents(
        workerSkills,
        workerEducation,
        workerExperience,
        vSkills,
        vacancy,
        workerProfile,
      );

      await this.upsertMatchScore({
        workerId,
        vacancyId,
        ...scores,
      });

      return 1;
    };

    const chunks: string[][] = [];
    for (let i = 0; i < vacancyIds.length; i += CONCURRENCY_LIMIT) {
      chunks.push(vacancyIds.slice(i, i + CONCURRENCY_LIMIT));
    }

    let totalCalculated = 0;
    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(processVacancy));
      totalCalculated += results.reduce((sum, r) => sum + r, 0);
    }

    return totalCalculated;
  }

  async recalculateBatchForVacancy(vacancyId: string, workerIds: string[]): Promise<number> {
    const vacancy = await this.getVacancy(vacancyId);
    if (!vacancy) return 0;

    const vacancySkills = await this.getVacancySkills(vacancyId);

    const workerProfiles = await this.prisma.workerProfile.findMany({
      where: { userId: { in: workerIds } }
    });

    const workerSkillsList = await this.prisma.workerSkill.findMany({
      where: { userId: { in: workerIds }, deletedAt: null }
    });

    const workerEducationList = await this.prisma.workerEducation.findMany({
      where: { userId: { in: workerIds }, deletedAt: null }
    });

    const workerExperienceList = await this.prisma.workerExperience.findMany({
      where: { userId: { in: workerIds }, deletedAt: null }
    });

    const workerProfileMap = new Map(workerProfiles.map(p => [p.userId, p]));
    const workerSkillsMap = new Map<string, any[]>();
    const workerEducationMap = new Map<string, any[]>();
    const workerExperienceMap = new Map<string, any[]>();

    for (const skill of workerSkillsList) {
      if (!workerSkillsMap.has(skill.userId)) workerSkillsMap.set(skill.userId, []);
      workerSkillsMap.get(skill.userId)!.push(skill);
    }
    for (const edu of workerEducationList) {
      if (!workerEducationMap.has(edu.userId)) workerEducationMap.set(edu.userId, []);
      workerEducationMap.get(edu.userId)!.push(edu);
    }
    for (const exp of workerExperienceList) {
      if (!workerExperienceMap.has(exp.userId)) workerExperienceMap.set(exp.userId, []);
      workerExperienceMap.get(exp.userId)!.push(exp);
    }

    const processWorker = async (workerId: string): Promise<number> => {
      const workerSkills = workerSkillsMap.get(workerId) || [];
      const workerEducation = workerEducationMap.get(workerId) || [];
      const workerExperience = workerExperienceMap.get(workerId) || [];
      const workerProfile = workerProfileMap.get(workerId);

      const scores = this.calculateScoreComponents(
        workerSkills,
        workerEducation,
        workerExperience,
        vacancySkills,
        vacancy,
        workerProfile,
      );

      await this.upsertMatchScore({
        workerId,
        vacancyId,
        ...scores,
      });

      return 1;
    };

    const chunks: string[][] = [];
    for (let i = 0; i < workerIds.length; i += CONCURRENCY_LIMIT) {
      chunks.push(workerIds.slice(i, i + CONCURRENCY_LIMIT));
    }

    let totalCalculated = 0;
    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(processWorker));
      totalCalculated += results.reduce((sum, r) => sum + r, 0);
    }

    return totalCalculated;
  }

  private calculateScoreComponents(
    workerSkills: any[],
    workerEducation: any[],
    workerExperience: any[],
    vacancySkills: any[],
    vacancy: any,
    workerProfile: any,
  ): ScoreComponents {
    const skillScore = this.calculateSkillScore(workerSkills, vacancySkills);
    const experienceScore = this.calculateExperienceScore(workerExperience, vacancy);
    const educationScore = this.calculateEducationScore(workerEducation, vacancy);
    const locationScore = this.calculateLocationScore(workerProfile, vacancy);
    const salaryScore = this.calculateSalaryScore(workerProfile, vacancy);

    const totalScore = Math.round(
      (skillScore * 0.40 +
        experienceScore * 0.25 +
        educationScore * 0.15 +
        locationScore * 0.10 +
        salaryScore * 0.10) * 100
    ) / 100;

    const requiredSkills = vacancySkills.filter((s: any) => s.isRequired);
    const matchedRequiredSkills = workerSkills.filter((ws: any) =>
      requiredSkills.some((rs: any) => rs.skillCode === ws.skillCode)
    );

    const isRecommended = totalScore >= 70 && matchedRequiredSkills.length >= requiredSkills.length * 0.5;

    return {
      skillScore,
      experienceScore,
      educationScore,
      locationScore,
      salaryScore,
      totalScore,
      skillMatchCount: workerSkills.filter((ws: any) =>
        vacancySkills.some((vs: any) => vs.skillCode === ws.skillCode)
      ).length,
      skillRequiredCount: requiredSkills.length,
      isRecommended,
    };
  }

  private calculateSkillScore(workerSkills: any[], vacancySkills: any[]): number {
    if (vacancySkills.length === 0) return 50;

    const matchedSkills = workerSkills.filter((ws: any) =>
      vacancySkills.some((vs: any) => vs.skillCode === ws.skillCode)
    );

    const matchRatio = matchedSkills.length / vacancySkills.length;
    return Math.round(matchRatio * 100 * 100) / 100;
  }

  private calculateExperienceScore(workerExperience: any[], vacancy: any): number {
    if (!vacancy.experienceMinYears && !vacancy.experienceMaxYears) return 50;

    const totalYears = workerExperience.reduce((sum: number, exp: any) => {
      return sum + ((exp.endYear || new Date().getFullYear()) - (exp.startYear || 0));
    }, 0);

    if (vacancy.experienceMinYears && totalYears < vacancy.experienceMinYears) {
      return Math.max(0, 100 - (vacancy.experienceMinYears - totalYears) * 10);
    }

    if (vacancy.experienceMaxYears && totalYears > vacancy.experienceMaxYears) {
      return Math.max(0, 100 - (totalYears - vacancy.experienceMaxYears) * 5);
    }

    return 100;
  }

  private calculateEducationScore(workerEducation: any[], vacancy: any): number {
    if (!vacancy.educationMinLevel) return 50;

    const educationLevels = ['HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE'];
    const vacancyLevelIndex = educationLevels.indexOf(vacancy.educationMinLevel);

    if (vacancyLevelIndex === -1) return 50;

    for (const edu of workerEducation) {
      const workerLevelIndex = educationLevels.indexOf(edu.degreeLevel);
      if (workerLevelIndex >= vacancyLevelIndex) {
        return 100;
      }
    }

    return Math.max(0, 100 - (vacancyLevelIndex * 25));
  }

  private calculateLocationScore(workerProfile: any, vacancy: any): number {
    if (!vacancy.locationCity || !workerProfile?.city) return 50;

    if (workerProfile.city.toLowerCase() === vacancy.locationCity.toLowerCase()) {
      return 100;
    }

    if (workerProfile.state && vacancy.locationState &&
      workerProfile.state.toLowerCase() === vacancy.locationState.toLowerCase()) {
      return 70;
    }

    if (vacancy.isRemote) {
      return 90;
    }

    return 30;
  }

  private calculateSalaryScore(workerProfile: any, vacancy: any): number {
    if (!vacancy.salaryMin && !vacancy.salaryMax) return 50;

    const expectedMin = vacancy.salaryMin?.toNumber() || 0;
    const expectedMax = vacancy.salaryMax?.toNumber() || expectedMin * 2;

    if (expectedMin === 0 && expectedMax === 0) return 50;

    return 80;
  }
}
