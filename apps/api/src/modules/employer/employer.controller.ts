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
import { EmployerService } from './employer.service';
import {
  UpdateEmployerProfileDto,
  CreateBranchDto,
  UpdateBranchDto,
  ListBranchesDto,
  CreateRecruiterDto,
  UpdateRecruiterDto,
  ListRecruitersDto,
} from './dto/employer.dto';
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

@ApiTags('Employer')
@Controller('api/v1/employers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class EmployerController {
  constructor(private readonly employerService: EmployerService) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Get own employer profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getMyProfile(@Req() req: RequestWithUser) {
    return this.employerService.getProfile(req.user.id, this.extractIp(req));
  }

  @Put('me/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own employer profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMyProfile(@Body() dto: UpdateEmployerProfileDto, @Req() req: RequestWithUser) {
    return this.employerService.updateProfile(req.user.id, dto, this.extractIp(req));
  }

  @Get('me/compliance')
  @ApiOperation({ summary: 'Check employer compliance status' })
  @ApiResponse({ status: 200, description: 'Compliance check result' })
  async checkCompliance(@Req() req: RequestWithUser) {
    return this.employerService.checkCompliance(req.user.id);
  }

  @Get('me/branches')
  @ApiOperation({ summary: 'List own branches' })
  @ApiResponse({ status: 200, description: 'Branches list retrieved successfully' })
  async listMyBranches(@Query() dto: ListBranchesDto, @Req() req: RequestWithUser) {
    return this.employerService.listBranches(req.user.id, dto, this.extractIp(req));
  }

  @Post('me/branches')
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  async createMyBranch(@Body() dto: CreateBranchDto, @Req() req: RequestWithUser) {
    return this.employerService.createBranch(req.user.id, dto, this.extractIp(req));
  }

  @Put('me/branches/:id')
  @ApiOperation({ summary: 'Update a branch' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  async updateMyBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: RequestWithUser,
  ) {
    return this.employerService.updateBranch(req.user.id, id, dto, this.extractIp(req));
  }

  @Delete('me/branches/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a branch' })
  @ApiResponse({ status: 200, description: 'Branch deleted successfully' })
  async deleteMyBranch(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.employerService.deleteBranch(req.user.id, id, this.extractIp(req));
  }

  @Get('me/recruiters')
  @ApiOperation({ summary: 'List own recruiters' })
  @ApiResponse({ status: 200, description: 'Recruiters list retrieved successfully' })
  async listMyRecruiters(@Query() dto: ListRecruitersDto, @Req() req: RequestWithUser) {
    return this.employerService.listRecruiters(req.user.id, dto, this.extractIp(req));
  }

  @Post('me/recruiters')
  @ApiOperation({ summary: 'Create a new recruiter' })
  @ApiResponse({ status: 201, description: 'Recruiter created successfully' })
  async createMyRecruiter(@Body() dto: CreateRecruiterDto, @Req() req: RequestWithUser) {
    return this.employerService.createRecruiter(req.user.id, dto, this.extractIp(req));
  }

  @Put('me/recruiters/:id')
  @ApiOperation({ summary: 'Update a recruiter' })
  @ApiResponse({ status: 200, description: 'Recruiter updated successfully' })
  async updateMyRecruiter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecruiterDto,
    @Req() req: RequestWithUser,
  ) {
    return this.employerService.updateRecruiter(req.user.id, id, dto, this.extractIp(req));
  }

  @Delete('me/recruiters/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a recruiter' })
  @ApiResponse({ status: 200, description: 'Recruiter deleted successfully' })
  async deleteMyRecruiter(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.employerService.deleteRecruiter(req.user.id, id, this.extractIp(req));
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return req.headers['x-real-ip'] as string || req.ip || 'unknown';
  }
}
