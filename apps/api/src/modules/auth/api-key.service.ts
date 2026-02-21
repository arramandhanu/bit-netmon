import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyService {
    constructor(private prisma: PrismaService) { }

    /**
     * Generate a new API key for a user.
     * Returns the raw key ONCE — it is hashed before storage.
     */
    async generateKey(userId: number, name: string, expiresInDays?: number) {
        const rawKey = `nm_${randomBytes(24).toString('hex')}`;
        const prefix = rawKey.substring(0, 10);
        const keyHash = createHash('sha256').update(rawKey).digest('hex');

        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 86400000)
            : null;

        const apiKey = await this.prisma.apiKey.create({
            data: { userId, name, keyHash, prefix, expiresAt },
            select: {
                id: true,
                name: true,
                prefix: true,
                expiresAt: true,
                createdAt: true,
            },
        });

        // Return the raw key only on creation
        return { ...apiKey, key: rawKey };
    }

    /**
     * Validate an API key from a request.
     * Returns the user if valid, null if invalid/expired.
     */
    async validateKey(rawKey: string) {
        const keyHash = createHash('sha256').update(rawKey).digest('hex');

        const apiKey = await this.prisma.apiKey.findFirst({
            where: {
                keyHash,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                user: {
                    select: { id: true, username: true, role: true, isActive: true },
                },
            },
        });

        if (!apiKey || !apiKey.user?.isActive) return null;

        // Update last used timestamp
        await this.prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() },
        });

        return apiKey.user;
    }

    /**
     * List API keys for a user (without hashes).
     */
    async listKeys(userId: number) {
        return this.prisma.apiKey.findMany({
            where: { userId },
            select: {
                id: true,
                name: true,
                prefix: true,
                isActive: true,
                lastUsedAt: true,
                expiresAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Revoke (deactivate) an API key.
     */
    async revokeKey(id: number, userId: number) {
        return this.prisma.apiKey.updateMany({
            where: { id, userId },
            data: { isActive: false },
        });
    }
}
