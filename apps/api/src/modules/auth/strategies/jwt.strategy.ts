import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../auth.repository';
import { UserStatus } from '@prisma/client';

interface JwtPayload {
  sub: string;
  role: string;
  sessionId: string;
  familyId: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authRepository: AuthRepository,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type. Expected access token',
        },
      });
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email',
        },
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended',
        },
      });
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated',
        },
      });
    }

    const currentRole = await this.authRepository.getUserRole(user.id);
    if (currentRole && currentRole !== user.role) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'ROLE_CHANGED',
          message: 'Role has been changed. Please login again',
        },
      });
    }

    const session = await this.authRepository.findSessionByAccessTokenJti(payload.sessionId);
    if (!session || session.isRevoked) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired. Please login again',
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
      familyId: payload.familyId,
    };
  }
}
