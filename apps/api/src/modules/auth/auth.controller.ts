import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeaders } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, LogoutDto, VerifyGovDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    sessionId: string;
    familyId: string;
  };
  sessionId?: string;
}

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (requires gov verification)' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or user exists' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const deviceInfo = this.extractDeviceInfo(req, dto.deviceFingerprint, dto.userAgent);
    return this.authService.register(dto, deviceInfo);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit(5, 60)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked or suspended' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const deviceInfo = this.extractDeviceInfo(req, dto.deviceFingerprint, dto.userAgent);
    return this.authService.login(dto, deviceInfo);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const deviceInfo = this.extractDeviceInfo(req, dto.deviceFingerprint);
    return this.authService.refreshToken(dto, deviceInfo);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate tokens' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiHeaders([
    { name: 'authorization', description: 'Bearer token' },
  ])
  async logout(@Body() dto: LogoutDto, @Req() req: RequestWithUser) {
    return this.authService.logout(req.user.id, dto, req.sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'User data retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Req() req: RequestWithUser) {
    return this.authService.validateUser(req.user.id);
  }

  @Post('gov/verify')
  @ApiOperation({ summary: 'Verify user identity through government API (stub)' })
  @ApiResponse({ status: 200, description: 'Verification initiated' })
  @ApiResponse({ status: 400, description: 'Invalid verification data' })
  async verifyGovIdentity(@Body() dto: VerifyGovDto) {
    return this.authService.verifyGovIdentity(dto);
  }

  private extractDeviceInfo(
    req: Request,
    providedFingerprint?: string,
    providedUserAgent?: string,
  ): { fingerprint: string; userAgent: string; ipAddress: string } {
    const userAgent = providedUserAgent || req.headers['user-agent'] || 'unknown';
    const fingerprint = providedFingerprint || this.generateDeviceFingerprint(req);
    const ipAddress = this.extractIpAddress(req);

    return {
      fingerprint,
      userAgent,
      ipAddress,
    };
  }

  private generateDeviceFingerprint(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const fingerprint = `${userAgent}-${acceptLanguage}`.slice(0, 32);
    return fingerprint || 'default-device-fingerprint';
  }

  private extractIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    return req.ip || 'unknown';
  }
}
