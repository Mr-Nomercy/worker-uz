import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../auth/audit.service';
import { WorkerRepository } from './worker.repository';
import {
  UpdateContactDto,
  CreateEducationDto,
  UpdateEducationDto,
  CreateExperienceDto,
  UpdateExperienceDto,
  CreateSkillDto,
  UpdateSkillDto,
  GenerateSnapshotDto,
  ListEducationDto,
  ListExperienceDto,
  ListSkillsDto,
  ViewWorkerCvDto,
} from './dto/worker.dto';
import { JobType, ProficiencyLevel } from '@prisma/client';

@Injectable()
export class WorkerService {
  constructor(
    private readonly workerRepository: WorkerRepository,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string, requesterId: string, requesterRole: string, ipAddress: string) {
    const workerProfile = await this.workerRepository.findWorkerProfileByUserId(userId);
    if (!workerProfile) {
      throw new NotFoundException({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Worker profile not found' },
      });
    }

    await this.auditService.log('WORKER_PROFILE_VIEWED', {
      userId: requesterId,
      targetUserId: userId,
      ipAddress,
      details: { action: 'view_own_profile' },
    });

    return workerProfile;
  }

  async updateContact(
    userId: string,
    dto: UpdateContactDto,
    ipAddress: string,
  ) {
    const user = await this.workerRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const hasPhone = dto.phone !== undefined;
    const hasEmail = dto.email !== undefined;

    if (!hasPhone && !hasEmail) {
      throw new BadRequestException({
        success: false,
        error: { code: 'NO_FIELDS_TO_UPDATE', message: 'At least one of phone or email must be provided' },
      });
    }

    const oldPhone = user.phone;

    const updateData: { phone?: string } = {};
    if (hasPhone) {
      updateData.phone = dto.phone;
    }

    const updatedUser = await this.workerRepository.updateUserContact(userId, updateData);

    await this.auditService.log('WORKER_CONTACT_UPDATED', {
      userId,
      ipAddress,
      details: {
        fieldChanged: hasPhone ? 'phone' : 'none',
        oldPhone,
        newPhone: hasPhone ? dto.phone : undefined,
      },
    });

    return {
      email: updatedUser.email,
      phone: updatedUser.phone,
    };
  }

  async listEducation(userId: string, dto: ListEducationDto) {
    const result = await this.workerRepository.listEducation(
      userId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
    );

    return {
      items: result.items.map(this.mapEducationToResponse),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async createEducation(
    userId: string,
    dto: CreateEducationDto,
    ipAddress: string,
  ) {
    const education = await this.workerRepository.createEducation(userId, {
      institutionName: dto.institutionName,
      institutionCode: dto.institutionCode,
      degree: dto.degree,
      fieldOfStudy: dto.fieldOfStudy,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      gradeGpa: dto.gradeGpa,
      gradeScale: dto.gradeScale,
    });

    const result = await this.workerRepository.atomicCreateSnapshotWithEducation(userId, education, 'WORKER_EDUCATION_ADDED');

    await this.auditService.log('WORKER_EDUCATION_CREATED', {
      userId,
      ipAddress,
      details: { 
        educationId: education.id, 
        institutionName: dto.institutionName,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return this.mapEducationToResponse(education);
  }

  async updateEducation(
    userId: string,
    educationId: string,
    dto: UpdateEducationDto,
    ipAddress: string,
  ) {
    const education = await this.workerRepository.findEducationById(educationId);
    if (!education || education.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EDUCATION_NOT_FOUND', message: 'Education record not found' },
      });
    }

    if (education.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot update another worker\'s education' },
      });
    }

    const updated = await this.workerRepository.updateEducation(educationId, {
      institutionName: dto.institutionName,
      institutionCode: dto.institutionCode,
      degree: dto.degree,
      fieldOfStudy: dto.fieldOfStudy,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      gradeGpa: dto.gradeGpa,
      gradeScale: dto.gradeScale,
    });

    const result = await this.workerRepository.atomicCreateSnapshotWithEducation(userId, updated, 'WORKER_EDUCATION_UPDATED');

    await this.auditService.log('WORKER_EDUCATION_UPDATED', {
      userId,
      ipAddress,
      details: {
        educationId,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return this.mapEducationToResponse(updated);
  }

  async deleteEducation(userId: string, educationId: string, ipAddress: string) {
    const education = await this.workerRepository.findEducationById(educationId);
    if (!education || education.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EDUCATION_NOT_FOUND', message: 'Education record not found' },
      });
    }

    if (education.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete another worker\'s education' },
      });
    }

    await this.workerRepository.softDeleteEducation(educationId);
    const result = await this.workerRepository.atomicCreateSnapshotWithEducation(userId, null, 'WORKER_EDUCATION_DELETED');

    await this.auditService.log('WORKER_EDUCATION_DELETED', {
      userId,
      ipAddress,
      details: { 
        educationId,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return { message: 'Education deleted successfully', educationId };
  }

  async listExperience(userId: string, dto: ListExperienceDto) {
    const result = await this.workerRepository.listExperience(
      userId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
    );

    return {
      items: result.items.map(this.mapExperienceToResponse),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async createExperience(
    userId: string,
    dto: CreateExperienceDto,
    ipAddress: string,
  ) {
    const experience = await this.workerRepository.createExperience(userId, {
      employerName: dto.employerName,
      employerRegNo: dto.employerRegNo,
      jobTitle: dto.jobTitle,
      jobType: dto.jobType as JobType,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      salary: dto.salary,
      currency: dto.currency,
      reasonForLeaving: dto.reasonForLeaving,
    });

    const result = await this.workerRepository.atomicCreateSnapshotWithExperience(userId, experience, 'WORKER_EXPERIENCE_ADDED');

    await this.auditService.log('WORKER_EXPERIENCE_CREATED', {
      userId,
      ipAddress,
      details: { 
        experienceId: experience.id, 
        employerName: dto.employerName,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return this.mapExperienceToResponse(experience);
  }

  async updateExperience(
    userId: string,
    experienceId: string,
    dto: UpdateExperienceDto,
    ipAddress: string,
  ) {
    const experience = await this.workerRepository.findExperienceById(experienceId);
    if (!experience || experience.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EXPERIENCE_NOT_FOUND', message: 'Experience record not found' },
      });
    }

    if (experience.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot update another worker\'s experience' },
      });
    }

    const updated = await this.workerRepository.updateExperience(experienceId, {
      employerName: dto.employerName,
      employerRegNo: dto.employerRegNo,
      jobTitle: dto.jobTitle,
      jobType: dto.jobType as JobType,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      salary: dto.salary,
      currency: dto.currency,
      reasonForLeaving: dto.reasonForLeaving,
    });

    const result = await this.workerRepository.atomicCreateSnapshotWithExperience(userId, updated, 'WORKER_EXPERIENCE_UPDATED');

    await this.auditService.log('WORKER_EXPERIENCE_UPDATED', {
      userId,
      ipAddress,
      details: {
        experienceId,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return this.mapExperienceToResponse(updated);
  }

  async deleteExperience(userId: string, experienceId: string, ipAddress: string) {
    const experience = await this.workerRepository.findExperienceById(experienceId);
    if (!experience || experience.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'EXPERIENCE_NOT_FOUND', message: 'Experience record not found' },
      });
    }

    if (experience.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete another worker\'s experience' },
      });
    }

    await this.workerRepository.softDeleteExperience(experienceId);
    const result = await this.workerRepository.atomicCreateSnapshotWithExperience(userId, null, 'WORKER_EXPERIENCE_DELETED');

    await this.auditService.log('WORKER_EXPERIENCE_DELETED', {
      userId,
      ipAddress,
      details: { 
        experienceId,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return { message: 'Experience deleted successfully', experienceId };
  }

  async listSkills(userId: string, dto: ListSkillsDto) {
    const result = await this.workerRepository.listSkills(
      userId,
      Math.max(1, dto.page || 1),
      Math.min(dto.pageSize || 20, 100),
    );

    return {
      items: result.items.map(this.mapSkillToResponse),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async createSkill(
    userId: string,
    dto: CreateSkillDto,
    ipAddress: string,
  ) {
    const skill = await this.workerRepository.createSkill(userId, {
      skillCode: dto.skillCode,
      skillName: dto.skillName,
      proficiencyLevel: dto.proficiencyLevel as ProficiencyLevel,
      yearsExperience: dto.yearsExperience,
    });

    const result = await this.workerRepository.atomicCreateSnapshotForUser(userId, 'WORKER_SKILL_ADDED');

    await this.auditService.log('WORKER_SKILL_CREATED', {
      userId,
      ipAddress,
      details: { 
        skillId: skill.id, 
        skillName: dto.skillName,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return this.mapSkillToResponse(skill);
  }

  async updateSkill(
    userId: string,
    skillId: string,
    dto: UpdateSkillDto,
    ipAddress: string,
  ) {
    const skill = await this.workerRepository.findSkillById(skillId);
    if (!skill || skill.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: 'Skill record not found' },
      });
    }

    if (skill.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot update another worker\'s skill' },
      });
    }

    const updated = await this.workerRepository.updateSkill(skillId, {
      skillCode: dto.skillCode,
      skillName: dto.skillName,
      proficiencyLevel: dto.proficiencyLevel as ProficiencyLevel,
      yearsExperience: dto.yearsExperience,
    });

    const result = await this.workerRepository.atomicCreateSnapshotForUser(userId, 'WORKER_SKILL_UPDATED');

    await this.auditService.log('WORKER_SKILL_UPDATED', {
      userId,
      ipAddress,
      details: {
        skillId,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return this.mapSkillToResponse(updated);
  }

  async deleteSkill(userId: string, skillId: string, ipAddress: string) {
    const skill = await this.workerRepository.findSkillById(skillId);
    if (!skill || skill.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: 'Skill record not found' },
      });
    }

    if (skill.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete another worker\'s skill' },
      });
    }

    await this.workerRepository.softDeleteSkill(skillId);
    const result = await this.workerRepository.atomicCreateSnapshotForUser(userId, 'WORKER_SKILL_DELETED');

    await this.auditService.log('WORKER_SKILL_DELETED', {
      userId,
      ipAddress,
      details: { 
        skillId,
        snapshotGenerated: !result.isDuplicate,
      },
    });

    return { message: 'Skill deleted successfully', skillId };
  }

  async generateSnapshot(userId: string, dto: GenerateSnapshotDto, ipAddress: string) {
    const currentSnapshot = await this.workerRepository.getCurrentSnapshot(userId);

    if (!dto.forceNew && currentSnapshot) {
      return {
        message: 'Current snapshot already exists',
        snapshot: this.mapSnapshotToResponse(currentSnapshot),
      };
    }

    const result = await this.workerRepository.atomicCreateSnapshotForUser(userId, 'WORKER_MANUAL_SNAPSHOT');

    await this.auditService.log('CV_SNAPSHOT_GENERATED', {
      userId,
      ipAddress,
      details: { 
        snapshotId: result.snapshot?.id, 
        version: result.snapshot?.snapshotVersion, 
        forceNew: dto.forceNew,
        isDuplicate: result.isDuplicate,
      },
    });

    if (result.isDuplicate) {
      return {
        message: 'No changes detected - snapshot unchanged',
        snapshot: this.mapSnapshotToResponse(result.snapshot!),
      };
    }

    return {
      message: 'CV snapshot generated successfully',
      snapshot: this.mapSnapshotToResponse(result.snapshot!),
    };
  }

  async listSnapshots(userId: string, page: number, pageSize: number) {
    const result = await this.workerRepository.listSnapshots(
      userId,
      Math.max(1, page),
      Math.min(pageSize, 100),
    );

    return {
      items: result.items.map(this.mapSnapshotToResponse),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async getCurrentSnapshot(userId: string) {
    const snapshot = await this.workerRepository.getCurrentSnapshot(userId);
    if (!snapshot) {
      throw new NotFoundException({
        success: false,
        error: { code: 'SNAPSHOT_NOT_FOUND', message: 'No CV snapshot found' },
      });
    }

    return this.mapSnapshotToResponse(snapshot);
  }

  async viewWorkerCv(
    employerId: string,
    dto: ViewWorkerCvDto,
    ipAddress: string,
  ) {
    const profile = await this.workerRepository.findWorkerProfileForEmployer(dto.workerId);
    if (!profile || profile.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'WORKER_NOT_FOUND', message: 'Worker profile not found' },
      });
    }

    if (profile.user.deletedAt) {
      throw new NotFoundException({
        success: false,
        error: { code: 'WORKER_DELETED', message: 'Worker account has been deleted' },
      });
    }

    const snapshot = await this.workerRepository.findCurrentSnapshotForEmployer(dto.workerId);
    if (!snapshot) {
      throw new NotFoundException({
        success: false,
        error: { code: 'CV_NOT_AVAILABLE', message: 'Worker has not generated a CV snapshot' },
      });
    }

    const [education, experience, skills] = await Promise.all([
      this.workerRepository.listEducation(dto.workerId, 1, 100),
      this.workerRepository.listExperience(dto.workerId, 1, 100),
      this.workerRepository.listSkills(dto.workerId, 1, 100),
    ]);

    await this.auditService.log('EMPLOYER_VIEWED_WORKER_CV', {
      userId: employerId,
      targetUserId: dto.workerId,
      ipAddress,
      details: { snapshotId: snapshot.id, version: snapshot.snapshotVersion },
    });

    return {
      workerId: dto.workerId,
      fullName: profile.fullName,
      profilePhotoUrl: profile.profilePhotoUrl,
      education: education.items.map(e => this.sanitizeEducationForEmployer(e)),
      experience: experience.items.map(exp => this.sanitizeExperienceForEmployer(exp)),
      skills: skills.items.map(s => this.sanitizeSkillForEmployer(s)),
      snapshotVersion: snapshot.snapshotVersion,
      snapshotHash: snapshot.sha256Hash,
      verifiedAt: profile.govVerifyAt,
    };
  }

  private sanitizeEducationForEmployer(edu: any) {
    return {
      institutionName: edu.institutionName,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy,
      startDate: edu.startDate,
      endDate: edu.endDate,
      gradeGpa: edu.gradeGpa,
      verifiedAt: edu.verifiedAt,
    };
  }

  private sanitizeExperienceForEmployer(exp: any) {
    return {
      employerName: exp.employerName,
      jobTitle: exp.jobTitle,
      jobType: exp.jobType,
      startDate: exp.startDate,
      endDate: exp.endDate,
      verifiedAt: exp.verifiedAt,
    };
  }

  private sanitizeSkillForEmployer(skill: any) {
    return {
      skillName: skill.skillName,
      proficiencyLevel: skill.proficiencyLevel,
      yearsExperience: skill.yearsExperience,
      verifiedAt: skill.verifiedAt,
    };
  }

  private mapEducationToResponse(edu: any) {
    return {
      id: edu.id,
      userId: edu.userId,
      institutionName: edu.institutionName,
      institutionCode: edu.institutionCode,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy,
      startDate: edu.startDate,
      endDate: edu.endDate,
      gradeGpa: edu.gradeGpa?.toNumber?.() || edu.gradeGpa,
      gradeScale: edu.gradeScale?.toNumber?.() || edu.gradeScale,
      verifiedAt: edu.verifiedAt,
      sourceSystem: edu.sourceSystem,
      createdAt: edu.createdAt,
    };
  }

  private mapExperienceToResponse(exp: any) {
    return {
      id: exp.id,
      userId: exp.userId,
      employerName: exp.employerName,
      employerRegNo: exp.employerRegNo,
      jobTitle: exp.jobTitle,
      jobType: exp.jobType,
      startDate: exp.startDate,
      endDate: exp.endDate,
      salary: exp.salary?.toNumber?.() || exp.salary,
      currency: exp.currency,
      reasonForLeaving: exp.reasonForLeaving,
      verifiedAt: exp.verifiedAt,
      sourceSystem: exp.sourceSystem,
      createdAt: exp.createdAt,
    };
  }

  private mapSkillToResponse(skill: any) {
    return {
      id: skill.id,
      userId: skill.userId,
      skillCode: skill.skillCode,
      skillName: skill.skillName,
      proficiencyLevel: skill.proficiencyLevel,
      yearsExperience: skill.yearsExperience,
      verifiedAt: skill.verifiedAt,
      createdAt: skill.createdAt,
    };
  }

  private mapSnapshotToResponse(snapshot: any) {
    return {
      id: snapshot.id,
      userId: snapshot.userId,
      snapshotVersion: snapshot.snapshotVersion,
      snapshotData: snapshot.snapshotData,
      sha256Hash: snapshot.sha256Hash,
      previousHash: snapshot.previousHash,
      govVerifyStatus: snapshot.govVerifyStatus,
      govVerifyAt: snapshot.govVerifyAt,
      sourceApi: snapshot.sourceApi,
      isCurrent: snapshot.isCurrent,
      createdAt: snapshot.createdAt,
    };
  }
}
