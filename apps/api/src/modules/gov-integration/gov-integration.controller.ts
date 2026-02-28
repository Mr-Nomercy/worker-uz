import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeaders } from '@nestjs/swagger';
import { GovIntegrationService } from './gov-integration.service';
import {
  VerifyWorkerDto,
  VerifyEmployerDto,
  VerifyEducationDto,
  GetCacheStatsDto,
  ClearCacheDto,
} from './dto/gov-integration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    sessionId: string;
    familyId: string;
  };
}

@ApiTags('Gov Integration')
@Controller('api/v1/gov')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class GovIntegrationController {
  constructor(private readonly govIntegrationService: GovIntegrationService) { }

  @Post('verify/worker')
  @HttpCode(HttpStatus.OK)
  @Roles('WORKER', 'ADMIN', 'SUPER_ADMIN')
  @RateLimit(3, 60)
  @ApiOperation({ summary: 'Verify worker identity via government API' })
  @ApiResponse({ status: 200, description: 'Worker verification result' })
  async verifyWorker(@Body() dto: VerifyWorkerDto, @Req() req: RequestWithUser) {
    return this.govIntegrationService.verifyWorker(req.user.id, dto, this.extractIp(req));
  }

  @Post('verify/employer')
  @HttpCode(HttpStatus.OK)
  @Roles('EMPLOYER', 'ADMIN', 'SUPER_ADMIN')
  @RateLimit(3, 60)
  @ApiOperation({ summary: 'Verify employer via government API' })
  @ApiResponse({ status: 200, description: 'Employer verification result' })
  async verifyEmployer(@Body() dto: VerifyEmployerDto, @Req() req: RequestWithUser) {
    return this.govIntegrationService.verifyEmployer(req.user.id, dto, this.extractIp(req));
  }

  @Post('verify/education')
  @HttpCode(HttpStatus.OK)
  @Roles('WORKER', 'ADMIN', 'SUPER_ADMIN')
  @RateLimit(3, 60)
  @ApiOperation({ summary: 'Verify worker education via government API' })
  @ApiResponse({ status: 200, description: 'Education verification result' })
  async verifyEducation(@Body() dto: VerifyEducationDto, @Req() req: RequestWithUser) {
    return this.govIntegrationService.verifyEducation(req.user.id, dto, this.extractIp(req));
  }

  @Get('cache/stats')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({ status: 200, description: 'Cache statistics' })
  async getCacheStats(@Query() dto: GetCacheStatsDto) {
    return this.govIntegrationService.getCacheStats(dto);
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Clear government API cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared' })
  async clearCache(@Body() dto: ClearCacheDto, @Req() req: RequestWithUser) {
    return this.govIntegrationService.clearCache(dto, this.extractIp(req));
  }

  @Get('logs')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get government API logs' })
  @ApiResponse({ status: 200, description: 'API logs list' })
  async getApiLogs(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('apiType') apiType?: string,
    @Query('status') status?: string,
  ) {
    return this.govIntegrationService.getApiLogs(
      page || 1,
      pageSize || 20,
      apiType,
      status,
    );
  }

  @Get('circuit-breaker/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get circuit breaker status' })
  @ApiResponse({ status: 200, description: 'Circuit breaker status' })
  async getCircuitBreakerStatus() {
    return this.govIntegrationService.getCircuitBreakerStatus();
  }

  private extractIp(req: RequestWithUser): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
