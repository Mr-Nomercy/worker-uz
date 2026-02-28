import { Module } from '@nestjs/common';
import { GovIntegrationController } from './gov-integration.controller';
import { GovIntegrationService } from './gov-integration.service';
import { GovIntegrationRepository } from './gov-integration.repository';
import { GovClientService } from './gov-client.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GovIntegrationController],
  providers: [GovIntegrationService, GovIntegrationRepository, GovClientService],
  exports: [GovIntegrationService, GovClientService, GovIntegrationRepository],
})
export class GovIntegrationModule {}
