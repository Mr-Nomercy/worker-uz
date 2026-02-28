import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { Logger } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

const logger = new Logger('Encryption');

function getKey(salt: Buffer): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required but not set');
  }
  
  if (encryptionKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  
  return scryptSync(encryptionKey, salt, 32);
}

export function validateEncryptionKey(): boolean {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    logger.error('ENCRYPTION_KEY environment variable is not set');
    return false;
  }
  
  if (encryptionKey.length < 32) {
    logger.error('ENCRYPTION_KEY must be at least 32 characters long');
    return false;
  }
  
  logger.log('Encryption key validation passed');
  return true;
}

export function encryptData(data: any): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = getKey(salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(jsonData, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

export function decryptData(encryptedData: string): any {
  const buffer = Buffer.from(encryptedData, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = getKey(salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  try {
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return decrypted.toString('utf8');
  }
}

export function hashData(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}
