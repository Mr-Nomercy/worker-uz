import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { IdentityRepository } from './identity.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IdentityController],
  providers: [IdentityService, IdentityRepository],
  exports: [IdentityService, IdentityRepository],
})
export class IdentityModule {}
