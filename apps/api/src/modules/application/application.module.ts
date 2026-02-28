import { Module } from '@nestjs/common';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { ApplicationRepository } from './application.repository';
import { AuthModule } from '../auth/auth.module';
import { WorkerModule } from '../worker/worker.module';
import { EmployerModule } from '../employer/employer.module';

@Module({
  imports: [AuthModule, WorkerModule, EmployerModule],
  controllers: [ApplicationController],
  providers: [ApplicationService, ApplicationRepository],
  exports: [ApplicationService, ApplicationRepository],
})
export class ApplicationModule {}
