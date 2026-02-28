import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GovIntegrationRepository } from './gov-integration.repository';
import { AuditService } from '../auth/audit.service';
import { GovApiStatus } from '@prisma/client';

interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT_MS = 30000;

@Injectable()
export class GovClientService {
  private readonly logger = new Logger(GovClientService.name);
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly repository: GovIntegrationRepository,
    private readonly auditService: AuditService,
  ) {}

  private getCircuitBreaker(apiType: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(apiType)) {
      this.circuitBreakers.set(apiType, {
        failures: 0,
        lastFailure: null,
        isOpen: false,
      });
    }
    return this.circuitBreakers.get(apiType)!;
  }

  private recordSuccess(apiType: string): void {
    const state = this.getCircuitBreaker(apiType);
    state.failures = 0;
    state.isOpen = false;
  }

  private recordFailure(apiType: string): void {
    const state = this.getCircuitBreaker(apiType);
    state.failures++;
    state.lastFailure = new Date();

    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      this.logger.warn(`Circuit breaker opened for ${apiType} after ${state.failures} failures`);
    }
  }

  private isCircuitOpen(apiType: string): boolean {
    const state = this.getCircuitBreaker(apiType);
    
    if (!state.isOpen) return false;

    if (state.lastFailure && Date.now() - state.lastFailure.getTime() > CIRCUIT_BREAKER_TIMEOUT_MS) {
      state.isOpen = false;
      state.failures = 0;
      this.logger.log(`Circuit breaker reset for ${apiType}`);
      return false;
    }

    return true;
  }

  async callGovApi<T>(
    apiType: string,
    endpoint: string,
    payload: any,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    if (this.isCircuitOpen(apiType)) {
      throw new Error(`Circuit breaker is open for ${apiType}. Please try again later.`);
    }

    const baseUrl = this.configService.get<string>('GOV_API_BASE_URL') || 'https://api.gov.example';
    const apiKey = this.configService.get<string>('GOV_API_KEY') || '';
    const url = `${baseUrl}${endpoint}`;

    const requestHash = this.repository.hashRequest({ endpoint, ...payload });

    const cached = await this.repository.getCacheEntry(requestHash);
    if (cached) {
      this.logger.debug(`Cache hit for ${apiType}`);
      return cached.responseData as T;
    }

    const logEntry = await this.repository.createGovApiLog({
      apiType,
      requestUrl: url,
      requestMethod: method,
      requestPayload: payload,
      requestHeaders: { 'X-API-Key': apiKey.substring(0, 8) + '...' },
    });

    let lastError: Error | null = null;
    let response: T | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();

        response = await this.executeRequest<T>(url, method, payload, apiKey);

        const responseTimeMs = Date.now() - startTime;

        await this.repository.updateGovApiLog(logEntry.id, {
          responseStatusCode: 200,
          responseBody: response,
          responseTimeMs,
          status: GovApiStatus.SUCCESS,
          govTransactionId: (response as any)?.transactionId,
        });

        await this.auditService.log('GOV_API_CALL_SUCCESS', {
          userId: 'SYSTEM',
          details: {
            apiType,
            endpoint,
            attempt: attempt + 1,
            responseTimeMs,
          },
        });

        await this.repository.createCacheEntry({
          requestHash,
          apiType,
          responseData: response,
          ttlSeconds: this.getTtlForApiType(apiType),
        });

        this.recordSuccess(apiType);
        return response;

      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Gov API call failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}`);

        await this.repository.updateGovApiLog(logEntry.id, {
          retryCount: attempt + 1,
          errorMessage: error.message,
          status: attempt >= MAX_RETRIES ? GovApiStatus.FAILED : GovApiStatus.PENDING,
        });

        if (attempt < MAX_RETRIES) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    this.recordFailure(apiType);

    await this.auditService.log('GOV_API_CALL_FAILED', {
      userId: 'SYSTEM',
      details: {
        apiType,
        endpoint,
        error: lastError?.message,
        attempts: MAX_RETRIES + 1,
      },
    });

    throw new Error(`Gov API call failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
  }

  private async executeRequest<T>(
    url: string,
    method: string,
    payload: any,
    apiKey: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getTtlForApiType(apiType: string): number {
    const ttlMap: Record<string, number> = {
      WORKER_IDENTITY_VERIFICATION: 86400,
      EMPLOYER_VERIFICATION: 86400,
      EDUCATION_VERIFICATION: 604800,
      EXPERIENCE_VERIFICATION: 604800,
    };
    return ttlMap[apiType] || 3600;
  }

  getCircuitBreakerStatus(): Record<string, { isOpen: boolean; failures: number; lastFailure: Date | null }> {
    const status: Record<string, any> = {};
    this.circuitBreakers.forEach((state, apiType) => {
      status[apiType] = {
        isOpen: state.isOpen,
        failures: state.failures,
        lastFailure: state.lastFailure,
      };
    });
    return status;
  }
}
