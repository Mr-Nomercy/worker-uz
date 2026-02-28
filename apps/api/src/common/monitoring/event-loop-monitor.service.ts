import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { monitorEventLoopDelay } from 'perf_hooks';

@Injectable()
export class EventLoopMonitorService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EventLoopMonitorService.name);
    private histogram: any;
    private interval: NodeJS.Timeout;

    onModuleInit() {
        this.histogram = monitorEventLoopDelay({ resolution: 10 });
        this.histogram.enable();

        this.interval = setInterval(() => {
            const p99 = this.histogram.percentile(99) / 1e6; // Convert nanoseconds to milliseconds

            if (p99 > 200) {
                this.logger.warn(`Heavy event loop lag detected! p99 response time is ${p99.toFixed(2)}ms. Possible blocking operation or CPU overload.`);
            }

            this.histogram.reset();
        }, 5000); // Sample moving window every 5 seconds
    }

    onModuleDestroy() {
        if (this.interval) clearInterval(this.interval);
        if (this.histogram) this.histogram.disable();
    }
}
