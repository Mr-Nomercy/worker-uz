import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, GovApiStatus } from '@prisma/client';
import { createHash } from 'crypto';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class GovIntegrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createGovApiLog(data: {
    apiType: string;
    requestUrl: string;
    requestMethod: string;
    requestPayload?: any;
    requestHeaders?: any;
  }): Promise<any> {
    return this.prisma.govApiLog.create({
      data: {
        apiType: data.apiType,
        requestUrl: data.requestUrl,
        requestMethod: data.requestMethod,
        requestPayload: data.requestPayload as Prisma.JsonObject,
        requestHeaders: data.requestHeaders as Prisma.JsonObject,
        status: GovApiStatus.PENDING,
      },
    });
  }

  async updateGovApiLog(
    id: string,
    data: {
      responseStatusCode?: number;
      responseBody?: any;
      responseTimeMs?: number;
      errorMessage?: string;
      govTransactionId?: string;
      status?: GovApiStatus;
      retryCount?: number;
    },
  ): Promise<any> {
    return this.prisma.govApiLog.update({
      where: { id },
      data: {
        responseStatusCode: data.responseStatusCode,
        responseBody: data.responseBody as Prisma.JsonObject,
        responseTimeMs: data.responseTimeMs,
        errorMessage: data.errorMessage,
        govTransactionId: data.govTransactionId,
        status: data.status,
        retryCount: data.retryCount,
      },
    });
  }

  async getCacheEntry(requestHash: string): Promise<any | null> {
    const now = new Date();
    return this.prisma.govResponseCache.findFirst({
      where: {
        requestHash,
        expiresAt: { gt: now },
      },
    });
  }

  async createCacheEntry(data: {
    requestHash: string;
    apiType: string;
    responseData: any;
    ttlSeconds?: number;
  }): Promise<any> {
    const ttl = data.ttlSeconds || 3600;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return this.prisma.govResponseCache.upsert({
      where: { requestHash: data.requestHash },
      create: {
        requestHash: data.requestHash,
        apiType: data.apiType,
        responseData: data.responseData as Prisma.JsonObject,
        ttlSeconds: ttl,
        expiresAt,
      },
      update: {
        responseData: data.responseData as Prisma.JsonObject,
        ttlSeconds: ttl,
        expiresAt,
      },
    });
  }

  async getCacheStats(apiType?: string): Promise<any[]> {
    const where = apiType ? { apiType } : {};

    const items = await this.prisma.govResponseCache.findMany({
      where,
      select: {
        apiType: true,
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const grouped = items.reduce((acc, item) => {
      if (!acc[item.apiType]) {
        acc[item.apiType] = { apiType: item.apiType, count: 0, oldest: item.createdAt };
      }
      acc[item.apiType].count++;
      if (item.createdAt < acc[item.apiType].oldest) {
        acc[item.apiType].oldest = item.createdAt;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }

  async clearCache(apiType: string, force: boolean = false): Promise<{ deleted: number }> {
    const result = await this.prisma.govResponseCache.deleteMany({
      where: force ? {} : { apiType },
    });
    return { deleted: result.count };
  }

  async listGovApiLogs(
    page: number,
    pageSize: number,
    apiType?: string,
    status?: GovApiStatus,
  ): Promise<PaginatedResult<any>> {
    const enforcedPageSize = Math.min(pageSize, 100);
    const where: any = {};

    if (apiType) where.apiType = apiType;
    if (status) where.status = status;

    const [items, totalCount] = await Promise.all([
      this.prisma.govApiLog.findMany({
        where,
        skip: (page - 1) * enforcedPageSize,
        take: enforcedPageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.govApiLog.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      pageSize: enforcedPageSize,
      totalPages: Math.ceil(totalCount / enforcedPageSize),
    };
  }

  hashRequest(payload: any): string {
    const data = JSON.stringify(payload);
    return createHash('sha256').update(data).digest('hex');
  }
}
