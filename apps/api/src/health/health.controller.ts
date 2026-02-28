import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { HealthService, GlobalHealthStatus } from './health.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';
import { Roles } from '../modules/auth/decorators/roles.decorator';

interface DeepHealthResponse {
  success: boolean;
  data: GlobalHealthStatus;
  meta: {
    version: string;
    timestamp: string;
    buildTimestamp: string;
    gitCommit: string;
    nodeVersion: string;
    uptimeSeconds: number;
  };
}

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) { }

  @Get('internal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Header('Content-Type', 'application/json')
  async internal(@Res() res: Response): Promise<void> {
    const startTimestamp = new Date().toISOString();

    const result = await this.healthService.checkAll();

    // Derived HTTP Status mapping
    // healthy -> 200, degraded -> 200 (still fundamentally up), unhealthy -> 503
    const httpStatus = result.status === 'unhealthy' ? 503 : 200;

    const metadata = this.healthService.getBuildMetadata();

    const response: DeepHealthResponse = {
      success: result.status !== 'unhealthy',
      data: result,
      meta: {
        version: metadata.version,
        timestamp: startTimestamp,
        buildTimestamp: metadata.buildTimestamp,
        gitCommit: metadata.gitCommit,
        nodeVersion: metadata.nodeVersion,
        uptimeSeconds: metadata.uptimeSeconds,
      }
    };

    res.status(httpStatus).json(response);
  }

  @Get('live')
  @Header('Content-Type', 'application/json')
  live(): any {
    return {
      success: true,
      data: { status: 'ok' },
    };
  }

  @Get('ready')
  @Header('Content-Type', 'application/json')
  async ready(@Res() res: Response): Promise<void> {
    // Rely exclusively on Deep checks logic for Readiness Probes to accurately reflect capacity
    const result = await this.healthService.checkAll();
    const httpStatus = result.status === 'unhealthy' ? 503 : 200;

    res.status(httpStatus).json({
      success: result.status !== 'unhealthy',
      data: {
        status: result.status === 'unhealthy' ? 'not_ready' : 'ready',
      },
    });
  }
}
