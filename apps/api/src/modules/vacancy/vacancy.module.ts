import { Module } from '@nestjs/common';
import { VacancyController } from './vacancy.controller';
import { VacancyService } from './vacancy.service';
import { VacancyRepository } from './vacancy.repository';
import { AuthModule } from '../auth/auth.module';
import { EmployerModule } from '../employer/employer.module';

@Module({
  imports: [AuthModule, EmployerModule],
  controllers: [VacancyController],
  providers: [VacancyService, VacancyRepository],
  exports: [VacancyService, VacancyRepository],
})
export class VacancyModule {}
