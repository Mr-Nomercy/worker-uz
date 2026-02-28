import { Injectable, OnModuleDestroy, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Server } from 'http';

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
    private readonly logger = new Logger(ShutdownService.name);
    private shuttingDown = false;
    private server?: Server;

    public setHttpServer(server: Server) {
        this.server = server;
    }

    public get isShuttingDown(): boolean {
        return this.shuttingDown;
    }

    // NestJS triggers this first on SIGTERM/SIGINT if enableShutdownHooks is called.
    onApplicationShutdown(signal: string) {
        if (this.shuttingDown) return;
        this.shuttingDown = true;

        this.logger.warn(`Received ${signal}. Starting graceful shutdown...`);

        // 1. Immediately stop accepting new connections
        if (this.server) {
            this.server.close((err) => {
                if (err) {
                    this.logger.error(`Error closing HTTP server: ${err.message}`);
                } else {
                    this.logger.log('HTTP server closed. No longer accepting new connections.');
                }
            });
        }

        // 2. Fallback timeout safety wall
        setTimeout(() => {
            this.logger.error('Graceful shutdown timeout (30s) reached. Forcing exit.');
            process.exit(1);
        }, 30000).unref(); // Prevent the timer itself from keeping the process alive
    }
}
