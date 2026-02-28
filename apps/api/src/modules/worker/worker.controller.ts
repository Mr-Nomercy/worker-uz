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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeaders } from '@nestjs/swagger';
import { WorkerService } from './worker.service';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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

@ApiTags('Worker')
@Controller('api/v1/workers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Get own worker profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getMyProfile(@Req() req: RequestWithUser) {
    return this.workerService.getProfile(req.user.id, req.user.id, req.user.role, this.extractIp(req));
  }

  @Put('me/contact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own contact information (phone/email only)' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  async updateMyContact(@Body() dto: UpdateContactDto, @Req() req: RequestWithUser) {
    return this.workerService.updateContact(req.user.id, dto, this.extractIp(req));
  }

  @Get('me/education')
  @ApiOperation({ summary: 'List own education records' })
  @ApiResponse({ status: 200, description: 'Education list retrieved successfully' })
  async listMyEducation(@Query() dto: ListEducationDto, @Req() req: RequestWithUser) {
    return this.workerService.listEducation(req.user.id, dto);
  }

  @Post('me/education')
  @ApiOperation({ summary: 'Add education record (triggers CV snapshot)' })
  @ApiResponse({ status: 201, description: 'Education created successfully' })
  async createMyEducation(@Body() dto: CreateEducationDto, @Req() req: RequestWithUser) {
    return this.workerService.createEducation(req.user.id, dto, this.extractIp(req));
  }

  @Put('me/education/:id')
  @ApiOperation({ summary: 'Update education record (triggers CV snapshot)' })
  @ApiResponse({ status: 200, description: 'Education updated successfully' })
  async updateMyEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEducationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.workerService.updateEducation(req.user.id, id, dto, this.extractIp(req));
  }

  @Delete('me/education/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete education record (triggers CV snapshot)' })
  @ApiResponse({ status: 200, description: 'Education deleted successfully' })
  async deleteMyEducation(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.workerService.deleteEducation(req.user.id, id, this.extractIp(req));
  }

  @Get('me/experience')
  @ApiOperation({ summary: 'List own experience records' })
  @ApiResponse({ status: 200, description: 'Experience list retrieved successfully' })
  async listMyExperience(@Query() dto: ListExperienceDto, @Req() req: RequestWithUser) {
    return this.workerService.listExperience(req.user.id, dto);
  }

  @Post('me/experience')
  @ApiOperation({ summary: 'Add experience record (triggers CV snapshot)' })
  @ApiResponse({ status: 201, description: 'Experience created successfully' })
  async createMyExperience(@Body() dto: CreateExperienceDto, @Req() req: RequestWithUser) {
    return this.workerService.createExperience(req.user.id, dto, this.extractIp(req));
  }

  @Put('me/experience/:id')
  @ApiOperation({ summary: 'Update experience record (triggers CV snapshot)' })
  @ApiResponse({ status: 200, description: 'Experience updated successfully' })
  async updateMyExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperienceDto,
    @Req() req: RequestWithUser,
  ) {
    return this.workerService.updateExperience(req.user.id, id, dto, this.extractIp(req));
  }

  @Delete('me/experience/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete experience record (triggers CV snapshot)' })
  @ApiResponse({ status: 200, description: 'Experience deleted successfully' })
  async deleteMyExperience(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.workerService.deleteExperience(req.user.id, id, this.extractIp(req));
  }

  @Get('me/skills')
  @ApiOperation({ summary: 'List own skills' })
  @ApiResponse({ status: 200, description: 'Skills list retrieved successfully' })
  async listMySkills(@Query() dto: ListSkillsDto, @Req() req: RequestWithUser) {
    return this.workerService.listSkills(req.user.id, dto);
  }

  @Post('me/skills')
  @ApiOperation({ summary: 'Add skill (triggers CV snapshot)' })
  @ApiResponse({ status: 201, description: 'Skill created successfully' })
  async createMySkill(@Body() dto: CreateSkillDto, @Req() req: RequestWithUser) {
    return this.workerService.createSkill(req.user.id, dto, this.extractIp(req));
  }

  @Put('me/skills/:id')
  @ApiOperation({ summary: 'Update skill (triggers CV snapshot)' })
  @ApiResponse({ status: 200, description: 'Skill updated successfully' })
  async updateMySkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
    @Req() req: RequestWithUser,
  ) {
    return this.workerService.updateSkill(req.user.id, id, dto, this.extractIp(req));
  }

  @Delete('me/skills/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete skill (triggers CV snapshot)' })
  @ApiResponse({ status: 200, description: 'Skill deleted successfully' })
  async deleteMySkill(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.workerService.deleteSkill(req.user.id, id, this.extractIp(req));
  }

  @Post('me/snapshots')
  @ApiOperation({ summary: 'Generate CV snapshot' })
  @ApiResponse({ status: 201, description: 'Snapshot generated successfully' })
  async generateSnapshot(@Body() dto: GenerateSnapshotDto, @Req() req: RequestWithUser) {
    return this.workerService.generateSnapshot(req.user.id, dto, this.extractIp(req));
  }

  @Get('me/snapshots')
  @ApiOperation({ summary: 'List CV snapshots' })
  @ApiResponse({ status: 200, description: 'Snapshots list retrieved successfully' })
  async listSnapshots(
    @Req() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.workerService.listSnapshots(req.user.id, page || 1, pageSize || 20);
  }

  @Get('me/snapshots/current')
  @ApiOperation({ summary: 'Get current CV snapshot' })
  @ApiResponse({ status: 200, description: 'Current snapshot retrieved successfully' })
  async getCurrentSnapshot(@Req() req: RequestWithUser) {
    return this.workerService.getCurrentSnapshot(req.user.id);
  }

  @Post('employer/cv')
  @UseGuards(RolesGuard)
  @Roles('EMPLOYER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'View worker CV (employer only - read current snapshot)' })
  @ApiResponse({ status: 200, description: 'CV retrieved successfully' })
  async viewWorkerCv(@Body() dto: ViewWorkerCvDto, @Req() req: RequestWithUser) {
    return this.workerService.viewWorkerCv(req.user.id, dto, this.extractIp(req));
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return req.headers['x-real-ip'] as string || req.ip || 'unknown';
  }
}
