import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MatchingRepository } from './matching.repository';
import { MatchingCacheService, CachedMatchScore } from './matching-cache.service';
import { AuditService } from '../auth/audit.service';

const BATCH_SIZE = 200;
const CONCURRENCY_LIMIT = 20;
const MIN_SCORE_THRESHOLD = 70;

interface ScoreResult {
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
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly matchingRepository: MatchingRepository,
    private readonly matchingCacheService: MatchingCacheService,
    private readonly auditService: AuditService,
  ) {}

  async calculateScore(workerId: string, vacancyId: string): Promise<ScoreResult> {
    const [vacancy, workerProfile, workerSkills, workerEducation, workerExperience, vacancySkills] = await Promise.all([
      this.matchingRepository.getVacancy(vacancyId),
      this.matchingRepository.getWorkerProfile(workerId),
      this.matchingRepository.getWorkerSkills(workerId),
      this.matchingRepository.getWorkerEducation(workerId),
      this.matchingRepository.getWorkerExperience(workerId),
      this.matchingRepository.getVacancySkills(vacancyId),
    ]);

    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    const scores = this.computeScore(
      workerSkills,
      workerEducation,
      workerExperience,
      vacancySkills,
      vacancy,
      workerProfile,
    );

    await this.matchingRepository.upsertMatchScore({
      workerId,
      vacancyId,
      ...scores,
    });

    await this.auditService.log('MATCH_SCORE_CALCULATED', {
      userId: workerId,
      details: {
        workerId,
        vacancyId,
        totalScore: scores.totalScore,
        isRecommended: scores.isRecommended,
      },
    });

    return {
      workerId,
      vacancyId,
      ...scores,
    };
  }

  async recalcForWorker(workerId: string, ipAddress?: string): Promise<{ calculated: number; batch: number }> {
    let page = 1;
    let totalCalculated = 0;
    let batchCount = 0;

    while (true) {
      const result = await this.matchingRepository.getActiveVacanciesForWorker(
        workerId,
        page,
        BATCH_SIZE,
      );

      if (result.items.length === 0) break;

      const vacancyIds = result.items.map((v: any) => v.id);
      const calculated = await this.matchingRepository.recalculateBatchForWorker(workerId, vacancyIds);
      totalCalculated += calculated;
      batchCount++;

      if (result.items.length < BATCH_SIZE) break;
      page++;
    }

    await this.auditService.log('WORKER_MATCHES_RECALCULATED', {
      userId: workerId,
      ipAddress: ipAddress || 'system',
      details: {
        workerId,
        totalCalculated,
        batches: batchCount,
      },
    });

    await this.matchingCacheService.invalidateWorkerCache(workerId);

    this.logger.log(`Recalculated ${totalCalculated} match scores for worker ${workerId}`);

    return { calculated: totalCalculated, batch: batchCount };
  }

  async recalcForVacancy(vacancyId: string, ipAddress?: string): Promise<{ calculated: number; batch: number }> {
    const vacancy = await this.matchingRepository.getVacancy(vacancyId);
    if (!vacancy) {
      throw new NotFoundException({
        success: false,
        error: { code: 'VACANCY_NOT_FOUND', message: 'Vacancy not found' },
      });
    }

    let page = 1;
    let totalCalculated = 0;
    let batchCount = 0;

    while (true) {
      const result = await this.matchingRepository.getActiveWorkersForVacancy(
        vacancyId,
        page,
        BATCH_SIZE,
      );

      if (result.items.length === 0) break;

      const workerIds = result.items.map((w: any) => w.userId);
      const calculated = await this.matchingRepository.recalculateBatchForVacancy(vacancyId, workerIds);
      totalCalculated += calculated;
      batchCount++;

      if (result.items.length < BATCH_SIZE) break;
      page++;
    }

    await this.auditService.log('VACANCY_MATCHES_RECALCULATED', {
      userId: 'system',
      ipAddress: ipAddress || 'system',
      details: {
        vacancyId,
        totalCalculated,
        batches: batchCount,
      },
    });

    await this.matchingCacheService.invalidateVacancyCache(vacancyId);

    this.logger.log(`Recalculated ${totalCalculated} match scores for vacancy ${vacancyId}`);

    return { calculated: totalCalculated, batch: batchCount };
  }

  async getRecommendedMatches(workerId: string, limit: number = 20) {
    const owner = `worker:${workerId}:${uuidv4()}`;

    const matches = await this.matchingCacheService.getOrSetWorkerCache(
      workerId,
      owner,
      async () => {
        const results = await this.matchingRepository.getWorkerMatches(workerId, 50);
        return results.map(this.toCachedMatchScore);
      },
    );

    return matches.slice(0, limit);
  }

  async getVacancyRecommendations(vacancyId: string, limit: number = 20) {
    const owner = `vacancy:${vacancyId}:${uuidv4()}`;

    const matches = await this.matchingCacheService.getOrSetVacancyCache(
      vacancyId,
      owner,
      async () => {
        const results = await this.matchingRepository.getRecommendedMatches(vacancyId, 50);
        return results.map(this.toCachedMatchScore);
      },
    );

    return matches.slice(0, limit);
  }

  async invalidateWorkerCache(workerId: string): Promise<void> {
    await this.matchingCacheService.invalidateWorkerCache(workerId);
  }

  async invalidateVacancyCache(vacancyId: string): Promise<void> {
    await this.matchingCacheService.invalidateVacancyCache(vacancyId);
  }

  private toCachedMatchScore(match: any): CachedMatchScore {
    return {
      workerId: match.workerId,
      vacancyId: match.vacancyId,
      totalScore: match.totalScore,
      skillScore: match.skillScore,
      experienceScore: match.experienceScore,
      educationScore: match.educationScore,
      locationScore: match.locationScore,
      salaryScore: match.salaryScore,
      skillMatchCount: match.skillMatchCount,
      skillRequiredCount: match.skillRequiredCount,
      isRecommended: match.isRecommended,
      cachedAt: new Date().toISOString(),
    };
  }

  private computeScore(
    workerSkills: any[],
    workerEducation: any[],
    workerExperience: any[],
    vacancySkills: any[],
    vacancy: any,
    workerProfile: any,
  ): ScoreComponents {
    const requiredSkills = vacancySkills.filter((s: any) => s.isRequired);
    const skillScore = this.calculateSkillScore(workerSkills, vacancySkills, requiredSkills);
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

    const isRecommended = totalScore >= MIN_SCORE_THRESHOLD;

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

  private calculateSkillScore(workerSkills: any[], vacancySkills: any[], requiredSkills: any[]): number {
    if (requiredSkills.length === 0) return 100;
    if (vacancySkills.length === 0) return 50;

    const matchedSkills = workerSkills.filter((ws: any) =>
      vacancySkills.some((vs: any) => vs.skillCode === ws.skillCode)
    );

    const matchRatio = matchedSkills.length / requiredSkills.length;
    return Math.round(Math.min(matchRatio, 1) * 100 * 100) / 100;
  }

  private calculateExperienceScore(workerExperience: any[], vacancy: any): number {
    const minYears = vacancy.experienceMinYears || 0;
    const maxYears = vacancy.experienceMaxYears || minYears + 10;

    if (minYears === 0 && maxYears === 0) return 100;

    const totalYears = workerExperience.reduce((sum: number, exp: any) => {
      return sum + ((exp.endYear || new Date().getFullYear()) - (exp.startYear || 0));
    }, 0);

    if (totalYears >= minYears && totalYears <= maxYears) {
      return 100;
    }

    if (totalYears < minYears) {
      const deficit = minYears - totalYears;
      const deviationPercent = deficit / minYears;
      return Math.max(0, 100 - (deviationPercent * 100));
    }

    const excess = totalYears - maxYears;
    const deviationPercent = excess / maxYears;
    return Math.max(0, 100 - (deviationPercent * 100));
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

    if (vacancy.salaryIsNegotiable) {
      return 80;
    }

    const salaryMin = vacancy.salaryMin?.toNumber() || 0;
    const salaryMax = vacancy.salaryMax?.toNumber() || salaryMin * 2;

    if (salaryMin === 0 && salaryMax === 0) return 50;

    const midPoint = (salaryMin + salaryMax) / 2;
    const deviation = 0.5 * midPoint;

    if (deviation === 0) return 100;

    const distance = Math.abs(0 - midPoint);
    const deviationPercent = distance / deviation;

    return Math.max(0, Math.round((1 - deviationPercent) * 100 * 100) / 100);
  }
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
