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
import { InterviewService } from './interview.service';
import {
  ScheduleInterviewDto,
  ConfirmInterviewDto,
  RejectInterviewDto,
  CancelInterviewDto,
  CompleteInterviewDto,
  ListInterviewsDto,
  ListVacancyInterviewsDto,
} from './dto/interview.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

@ApiTags('Interview')
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('applications/:applicationId/interview')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule interview (employer)' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 201, description: 'Interview scheduled successfully' })
  async scheduleInterview(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: ScheduleInterviewDto,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.scheduleInterview(
      req.user.id,
      { ...dto, applicationId },
      this.extractIp(req),
    );
  }

  @Post('interviews/:interviewId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm interview (worker)' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview confirmed successfully' })
  async confirmInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: ConfirmInterviewDto,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.confirmInterview(req.user.id, interviewId, dto, this.extractIp(req));
  }

  @Post('interviews/:interviewId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject interview (worker)' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview rejected successfully' })
  async rejectInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: RejectInterviewDto,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.rejectInterview(req.user.id, interviewId, dto, this.extractIp(req));
  }

  @Post('interviews/:interviewId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel interview (employer)' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview cancelled successfully' })
  async cancelInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: CancelInterviewDto,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.cancelInterview(req.user.id, interviewId, dto, this.extractIp(req));
  }

  @Post('interviews/:interviewId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete interview (employer)' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview completed successfully' })
  async completeInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: CompleteInterviewDto,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.completeInterview(req.user.id, interviewId, dto, this.extractIp(req));
  }

  @Get('interviews/me')
  @ApiOperation({ summary: 'List own interviews (worker)' })
  @ApiResponse({ status: 200, description: 'Interviews list retrieved successfully' })
  async listMyInterviews(@Query() dto: ListInterviewsDto, @Req() req: RequestWithUser) {
    return this.interviewService.listMyInterviews(req.user.id, dto, this.extractIp(req));
  }

  @Get('interviews/me/:interviewId')
  @ApiOperation({ summary: 'Get own interview (worker)' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview retrieved successfully' })
  async getMyInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.getInterview(req.user.id, interviewId, this.extractIp(req));
  }

  @Get('vacancies/:vacancyId/interviews')
  @ApiOperation({ summary: 'List interviews by vacancy (employer)' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Interviews list retrieved successfully' })
  async listVacancyInterviews(
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Query() dto: ListVacancyInterviewsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.interviewService.listVacancyInterviews(req.user.id, vacancyId, dto, this.extractIp(req));
  }

  private extractIp(req: RequestWithUser): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
