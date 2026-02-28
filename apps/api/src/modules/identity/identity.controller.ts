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
import { IdentityService } from './identity.service';
import {
  ListUsersDto,
  UpdateUserStatusDto,
  SoftDeleteUserDto,
  ListSessionsDto,
  RevokeSessionDto,
  RevokeAllSessionsDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  ListRolesDto,
  ListPermissionsDto,
} from './dto/identity.dto';
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

@ApiTags('Identity Management')
@Controller('api/v1/identity')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeaders([{ name: 'authorization', description: 'Bearer token' }])
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('users')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async listUsers(@Query() dto: ListUsersDto, @Req() req: RequestWithUser) {
    return this.identityService.listUsers(dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Get('users/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.identityService.getUser(id, req.user.id, req.user.role, this.extractIp(req));
  }

  @Put('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update user status (admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or cannot update self' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.updateUserStatus(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete user (admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or cannot delete self' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async softDeleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SoftDeleteUserDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.softDeleteUser(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Get('users/:id/sessions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List user sessions (admin only)' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async listSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListSessionsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.listSessions(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Post('users/:id/sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Revoke a specific session (admin only)' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RevokeSessionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.revokeSession(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Post('users/:id/sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Revoke all user sessions (admin only)' })
  @ApiResponse({ status: 200, description: 'All sessions revoked successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async revokeAllSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeAllSessionsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.revokeAllSessions(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a new role (super admin only)' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  async createRole(@Body() dto: CreateRoleDto, @Req() req: RequestWithUser) {
    return this.identityService.createRole(dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Get('roles')
  @ApiOperation({ summary: 'List all roles (super admin only)' })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required' })
  async listRoles(@Query() dto: ListRolesDto, @Req() req: RequestWithUser) {
    return this.identityService.listRoles(dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get role by ID (super admin only)' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async getRole(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.identityService.getRole(id, req.user.id, req.user.role, this.extractIp(req));
  }

  @Put('roles/:id')
  @ApiOperation({ summary: 'Update role (super admin only)' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.updateRole(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete role (super admin only)' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required or cannot delete last SUPER_ADMIN' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async deleteRole(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.identityService.deleteRole(id, req.user.id, req.user.role, this.extractIp(req));
  }

  @Post('roles/:id/permissions')
  @ApiOperation({ summary: 'Assign permissions to role (super admin only)' })
  @ApiResponse({ status: 201, description: 'Permissions assigned successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.identityService.assignPermissions(id, dto, req.user.id, req.user.role, this.extractIp(req));
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all permissions (super admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Super admin access required' })
  async listPermissions(@Query() dto: ListPermissionsDto, @Req() req: RequestWithUser) {
    return this.identityService.listPermissions(dto, req.user.id, req.user.role, this.extractIp(req));
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return req.headers['x-real-ip'] as string || req.ip || 'unknown';
  }
}
