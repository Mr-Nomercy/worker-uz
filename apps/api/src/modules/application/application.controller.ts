import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeaders, ApiParam } from '@nestjs/swagger';
import { ApplicationService } from './application.service';
import {
  ApplyToVacancyDto,
  ListApplicationsDto,
  ListVacancyApplicationsDto,
  UpdateApplicationStatusDto,
  WithdrawApplicationDto,
} from './dto/application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

@ApiTags('Application')
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) { }

  @Post('vacancies/:vacancyId/apply')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Apply to a vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async applyToVacancy(
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.applicationService.applyToVacancy(
      req.user.id,
      { vacancyId },
      this.extractIp(req),
    );
  }

  @Get('applications/me')
  @ApiOperation({ summary: 'List own applications' })
  @ApiResponse({ status: 200, description: 'Applications list retrieved successfully' })
  async listMyApplications(@Query() dto: ListApplicationsDto, @Req() req: RequestWithUser) {
    return this.applicationService.listMyApplications(req.user.id, dto, this.extractIp(req));
  }

  @Get('applications/me/:applicationId')
  @ApiOperation({ summary: 'Get own application by ID' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'Application retrieved successfully' })
  async getMyApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.applicationService.getMyApplication(req.user.id, applicationId, this.extractIp(req));
  }

  @Post('applications/me/:applicationId/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw own application' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'Application withdrawn successfully' })
  async withdrawApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: WithdrawApplicationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.applicationService.withdrawApplication(req.user.id, applicationId, dto, this.extractIp(req));
  }

  @Get('vacancies/:vacancyId/applications')
  @ApiOperation({ summary: 'List applications for a vacancy (employer)' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Applications list retrieved successfully' })
  async listVacancyApplications(
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Query() dto: ListVacancyApplicationsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.applicationService.listVacancyApplications(req.user.id, vacancyId, dto, this.extractIp(req));
  }

  @Put('applications/:applicationId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update application status (employer)' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'Application status updated successfully' })
  async updateApplicationStatus(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.applicationService.updateApplicationStatus(req.user.id, applicationId, dto, this.extractIp(req));
  }

  private extractIp(req: RequestWithUser): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
