import { Logger } from '@nestjs/common';

export function validateEnvironmentVariables(): void {
    const logger = new Logger('EnvValidation');

    const requiredVariables = [
        'NODE_ENV',
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
    ];

    const missingVariables: string[] = [];
    const invalidVariables: string[] = [];

    // Check existence
    for (const variable of requiredVariables) {
        if (!process.env[variable]) {
            missingVariables.push(variable);
        }
    }

    // Value length checks (only if they exist)
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        invalidVariables.push('JWT_SECRET must be at least 32 characters long.');
    }

    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
        invalidVariables.push('ENCRYPTION_KEY must be at least 32 characters long.');
    }

    // If anything failed, log strictly and terminate
    if (missingVariables.length > 0 || invalidVariables.length > 0) {
        logger.error('CRITICAL: Environment validation failed!');

        if (missingVariables.length > 0) {
            logger.error(`Missing required environment variables: ${missingVariables.join(', ')}`);
        }

        for (const invalidMsg of invalidVariables) {
            logger.error(`Invalid configuration: ${invalidMsg}`);
        }

        // Force strict exit before continuing application bootstrap
        process.exit(1);
    }

    logger.log('Environment variables validated successfully.');
}
