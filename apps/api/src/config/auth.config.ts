import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtAlgorithm: 'HS256',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-change-in-production',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  argon2: {
    type: 'argon2id',
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10),
    timeCost: parseInt(process.env.ARGON2_TIME_COST || '3', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM || '4', 10),
    hashLength: 32,
  },
  bruteForce: {
    maxAttempts: parseInt(process.env.BRUTE_FORCE_MAX_ATTEMPTS || '5', 10),
    baseLockDurationMs: parseInt(process.env.BRUTE_FORCE_BASE_LOCK_DURATION_MS || '300000', 10),
    maxLockDurationMs: parseInt(process.env.BRUTE_FORCE_MAX_LOCK_DURATION_MS || '86400000', 10),
    progressiveMultiplier: parseInt(process.env.BRUTE_FORCE_PROGRESSIVE_MULTIPLIER || '2', 10),
    trackingWindowMs: parseInt(process.env.BRUTE_FORCE_TRACKING_WINDOW_MS || '900000', 10),
  },
  session: {
    deviceFingerprintLength: parseInt(process.env.SESSION_DEVICE_FINGERPRINT_LENGTH || '32', 10),
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
  },
  refreshToken: {
    reuseDetection: true,
    rotateOnRefresh: true,
  },
}));
