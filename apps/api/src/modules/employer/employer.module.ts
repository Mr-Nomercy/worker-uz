import { Module } from '@nestjs/common';
import { EmployerController } from './employer.controller';
import { EmployerService } from './employer.service';
import { EmployerRepository } from './employer.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EmployerController],
  providers: [EmployerService, EmployerRepository],
  exports: [EmployerService, EmployerRepository],
})
export class EmployerModule {}
