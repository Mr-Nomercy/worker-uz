import { Module } from '@nestjs/common';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { InterviewRepository } from './interview.repository';
import { AuthModule } from '../auth/auth.module';
import { EmployerModule } from '../employer/employer.module';

@Module({
  imports: [AuthModule, EmployerModule],
  controllers: [InterviewController],
  providers: [InterviewService, InterviewRepository],
  exports: [InterviewService, InterviewRepository],
})
export class InterviewModule {}
