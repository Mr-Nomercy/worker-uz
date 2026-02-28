import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GovIntegrationRepository } from './gov-integration.repository';
import { GovClientService } from './gov-client.service';
import { AuditService } from '../auth/audit.service';
import {
  VerifyWorkerDto,
  VerifyEmployerDto,
  VerifyEducationDto,
  GetCacheStatsDto,
  ClearCacheDto,
} from './dto/gov-integration.dto';
import {
  WorkerVerificationResponseDto,
  EmployerVerificationResponseDto,
  EducationVerificationResponseDto,
  CacheStatsResponseDto,
  GovApiLogResponseDto,
} from './dto/gov-integration-response.dto';
import { encryptData, decryptData } from '../../common/utils/encryption';

@Injectable()
export class GovIntegrationService {
  private readonly logger = new Logger(GovIntegrationService.name);

  constructor(
    private readonly repository: GovIntegrationRepository,
    private readonly govClient: GovClientService,
    private readonly auditService: AuditService,
  ) {}

  async verifyWorker(
    workerUserId: string,
    dto: VerifyWorkerDto,
    ipAddress: string,
  ): Promise<WorkerVerificationResponseDto> {
    const encryptedData = encryptData({
      pinfl: dto.pinfl,
      documentNumber: dto.documentNumber,
    });

    const result = await this.govClient.callGovApi<any>(
      'WORKER_IDENTITY_VERIFICATION',
      '/api/v1/verify/worker',
      {
        pinfl: dto.pinfl,
        documentNumber: dto.documentNumber,
        documentType: dto.documentType,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate,
      },
    );

    await this.auditService.log('WORKER_IDENTITY_VERIFICATION', {
      userId: workerUserId,
      ipAddress,
      details: {
        pinfl: dto.pinfl.substring(0, 4) + '****',
        verified: result.verified,
        transactionId: result.transactionId,
      },
    });

    return {
      success: true,
      verified: result.verified || false,
      message: result.message,
      data: result.data,
      transactionId: result.transactionId,
      workerId: result.workerId,
      fullName: result.fullName,
      birthDate: result.birthDate,
      address: result.address,
    };
  }

  async verifyEmployer(
    employerUserId: string,
    dto: VerifyEmployerDto,
    ipAddress: string,
  ): Promise<EmployerVerificationResponseDto> {
    const result = await this.govClient.callGovApi<any>(
      'EMPLOYER_VERIFICATION',
      '/api/v1/verify/employer',
      {
        businessRegNo: dto.businessRegNo,
        companyName: dto.companyName,
        taxId: dto.taxId,
      },
    );

    await this.auditService.log('EMPLOYER_VERIFICATION', {
      userId: employerUserId,
      ipAddress,
      details: {
        businessRegNo: dto.businessRegNo.substring(0, 4) + '****',
        verified: result.verified,
        transactionId: result.transactionId,
      },
    });

    return {
      success: true,
      verified: result.verified || false,
      message: result.message,
      data: result.data,
      transactionId: result.transactionId,
      employerId: result.employerId,
      companyName: result.companyName,
      registrationDate: result.registrationDate,
      status: result.status,
    };
  }

  async verifyEducation(
    workerUserId: string,
    dto: VerifyEducationDto,
    ipAddress: string,
  ): Promise<EducationVerificationResponseDto> {
    const result = await this.govClient.callGovApi<any>(
      'EDUCATION_VERIFICATION',
      '/api/v1/verify/education',
      {
        pinfl: dto.pinfl,
        institutionCode: dto.institutionCode,
        diplomaNumber: dto.diplomaNumber,
        graduationYear: dto.graduationYear,
      },
    );

    await this.auditService.log('EDUCATION_VERIFICATION', {
      userId: workerUserId,
      ipAddress,
      details: {
        pinfl: dto.pinfl.substring(0, 4) + '****',
        diplomaNumber: dto.diplomaNumber.substring(0, 4) + '****',
        verified: result.verified,
        transactionId: result.transactionId,
      },
    });

    return {
      success: true,
      verified: result.verified || false,
      message: result.message,
      data: result.data,
      transactionId: result.transactionId,
      institutionName: result.institutionName,
      degree: result.degree,
      graduationYear: result.graduationYear,
    };
  }

  async getCacheStats(dto: GetCacheStatsDto): Promise<CacheStatsResponseDto[]> {
    const stats = await this.repository.getCacheStats(dto.apiType);

    return stats.map(s => ({
      apiType: s.apiType,
      hitCount: 0,
      missCount: 0,
      totalEntries: s._count.id,
      oldestEntry: s._min.createdAt,
    }));
  }

  async clearCache(dto: ClearCacheDto, ipAddress: string): Promise<{ deleted: number }> {
    const result = await this.repository.clearCache(dto.apiType, dto.force || false);

    await this.auditService.log('GOV_CACHE_CLEARED', {
      userId: 'SYSTEM',
      ipAddress,
      details: {
        apiType: dto.apiType,
        force: dto.force,
        deleted: result.deleted,
      },
    });

    return result;
  }

  async getApiLogs(
    page: number,
    pageSize: number,
    apiType?: string,
    status?: string,
  ): Promise<{ items: GovApiLogResponseDto[]; totalCount: number; page: number; pageSize: number; totalPages: number }> {
    const result = await this.repository.listGovApiLogs(page, pageSize, apiType, status as any);

    return {
      items: result.items.map(log => ({
        id: log.id,
        apiType: log.apiType,
        requestUrl: log.requestUrl,
        requestMethod: log.requestMethod,
        responseStatusCode: log.responseStatusCode,
        responseTimeMs: log.responseTimeMs,
        status: log.status,
        retryCount: log.retryCount,
        createdAt: log.createdAt,
      })),
      totalCount: result.totalCount,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  getCircuitBreakerStatus() {
    return this.govClient.getCircuitBreakerStatus();
  }
}
