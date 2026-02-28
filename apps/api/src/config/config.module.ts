import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';

@Global()
@NestConfigModule.forRoot({
  isGlobal: true,
  load: [appConfig, authConfig, databaseConfig, redisConfig],
  validationSchema: null,
  validationOptions: {
    abortEarly: true,
  },
  envFilePath: ['.env.local', '.env'],
  cache: true,
})
export class ConfigModule {}

export { AppConfigService };
