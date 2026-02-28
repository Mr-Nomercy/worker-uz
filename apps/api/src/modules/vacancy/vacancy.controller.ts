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
import { VacancyService } from './vacancy.service';
import {
  CreateVacancyDto,
  UpdateVacancyDto,
  ListVacanciesDto,
  PublishVacancyDto,
} from './dto/vacancy.dto';
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

@ApiTags('Vacancy')
@Controller('api/v1/vacancies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class VacancyController {
  constructor(private readonly vacancyService: VacancyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vacancy' })
  @ApiResponse({ status: 201, description: 'Vacancy created successfully' })
  async createVacancy(@Body() dto: CreateVacancyDto, @Req() req: RequestWithUser) {
    return this.vacancyService.createVacancy(req.user.id, dto, this.extractIp(req));
  }

  @Get()
  @ApiOperation({ summary: 'List own vacancies' })
  @ApiResponse({ status: 200, description: 'Vacancies list retrieved successfully' })
  async listVacancies(@Query() dto: ListVacanciesDto, @Req() req: RequestWithUser) {
    return this.vacancyService.listVacancies(req.user.id, dto, this.extractIp(req));
  }

  @Get(':vacancyId')
  @ApiOperation({ summary: 'Get vacancy by ID' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Vacancy retrieved successfully' })
  async getVacancy(@Param('vacancyId', ParseUUIDPipe) vacancyId: string, @Req() req: RequestWithUser) {
    return this.vacancyService.getVacancy(req.user.id, vacancyId, this.extractIp(req));
  }

  @Put(':vacancyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Vacancy updated successfully' })
  async updateVacancy(
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Body() dto: UpdateVacancyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.vacancyService.updateVacancy(req.user.id, vacancyId, dto, this.extractIp(req));
  }

  @Post(':vacancyId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Vacancy published successfully' })
  async publishVacancy(
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Body() dto: PublishVacancyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.vacancyService.publishVacancy(req.user.id, vacancyId, dto, this.extractIp(req));
  }

  @Post(':vacancyId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Vacancy closed successfully' })
  async closeVacancy(@Param('vacancyId', ParseUUIDPipe) vacancyId: string, @Req() req: RequestWithUser) {
    return this.vacancyService.closeVacancy(req.user.id, vacancyId, this.extractIp(req));
  }

  @Delete(':vacancyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Vacancy deleted successfully' })
  async deleteVacancy(@Param('vacancyId', ParseUUIDPipe) vacancyId: string, @Req() req: RequestWithUser) {
    return this.vacancyService.deleteVacancy(req.user.id, vacancyId, this.extractIp(req));
  }

  @Get(':vacancyId/versions')
  @ApiOperation({ summary: 'List vacancy versions' })
  @ApiParam({ name: 'vacancyId', description: 'Vacancy UUID' })
  @ApiResponse({ status: 200, description: 'Versions list retrieved successfully' })
  async getVersions(
    @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Req() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.vacancyService.getVersions(
      req.user.id,
      vacancyId,
      page || 1,
      pageSize || 20,
      this.extractIp(req),
    );
  }

  private extractIp(req: RequestWithUser): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
