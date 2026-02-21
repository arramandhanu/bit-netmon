import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    scryptSync,
} from 'crypto';

/**
 * Encrypts and decrypts sensitive data (SNMP community strings,
 * v3 passwords) using AES-256-GCM.
 *
 * Storage format: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * The encryption key is derived from the ENCRYPTION_KEY env var
 * using scrypt with a fixed salt. In production, rotate by
 * re-encrypting all credentials with the new key.
 */
@Injectable()
export class EncryptionService {
    private readonly key: Buffer;
    private static readonly ALGORITHM = 'aes-256-gcm' as const;
    private static readonly IV_LENGTH = 16;
    private static readonly SALT = 'netmon-credential-salt';

    constructor(config: ConfigService) {
        const secret = config.getOrThrow<string>('encryptionKey');
        this.key = scryptSync(secret, EncryptionService.SALT, 32);
    }

    encrypt(plaintext: string): string {
        const iv = randomBytes(EncryptionService.IV_LENGTH);
        const cipher = createCipheriv(EncryptionService.ALGORITHM, this.key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        return [
            iv.toString('hex'),
            authTag.toString('hex'),
            encrypted,
        ].join(':');
    }

    decrypt(encryptedData: string): string {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, authTagHex, ciphertext] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = createDecipheriv(EncryptionService.ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    /**
     * Check if a string looks like it's already encrypted
     * (matches the iv:tag:cipher hex format).
     */
    isEncrypted(value: string): boolean {
        const parts = value.split(':');
        if (parts.length !== 3) return false;
        return /^[0-9a-f]+$/.test(parts[0]) && parts[0].length === 32;
    }
}
