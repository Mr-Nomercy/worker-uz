import { Module, Global } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service';
import { correlationIdStorage } from '../common/interceptors/logging.interceptor';

@Global()
@PinoLoggerModule.forRootAsync({
  inject: [AppConfigService],
  useFactory: (configService: AppConfigService) => ({
    pinoHttp: {
      level: configService.isDevelopment ? 'debug' : 'info',
      autoLogging: {
        ignore: (req: any) => req.url === '/health',
      },
      mixin: () => {
        const correlationId = correlationIdStorage.getStore();
        return correlationId ? { correlationId } : {};
      },
      transport: configService.isDevelopment
        ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
        : undefined,
      serializers: {
        req: () => undefined,
        res: () => undefined,
        err: () => undefined,
      },
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
  }),
})
export class LoggingModule { }
