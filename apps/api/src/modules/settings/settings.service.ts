import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SettingsService {
    // In-memory cache: key → { value, expiresAt }
    private cache = new Map<string, { value: string; expiresAt: number }>();
    private readonly CACHE_TTL_MS = 60_000; // 60 seconds

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get all settings, optionally filtered by category.
     */
    async getAll(category?: string) {
        const where = category ? { category } : {};
        const rows = await this.prisma.systemSetting.findMany({
            where,
            orderBy: { key: 'asc' },
        });

        const grouped: Record<string, Record<string, string>> = {};
        for (const row of rows) {
            if (!grouped[row.category]) grouped[row.category] = {};
            grouped[row.category][row.key] = row.value;
            // Populate cache
            this.cache.set(row.key, { value: row.value, expiresAt: Date.now() + this.CACHE_TTL_MS });
        }
        return grouped;
    }

    /**
     * Get a single setting by key (with 60s cache).
     */
    async get(key: string): Promise<string | null> {
        // Check cache first
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        const row = await this.prisma.systemSetting.findUnique({ where: { key } });
        const value = row?.value ?? null;

        if (value !== null) {
            this.cache.set(key, { value, expiresAt: Date.now() + this.CACHE_TTL_MS });
        }

        return value;
    }

    /**
     * Get a setting as a string with a fallback default.
     */
    async getString(key: string, fallback: string): Promise<string> {
        const value = await this.get(key);
        return value ?? fallback;
    }

    /**
     * Get a setting as a number with a fallback default.
     */
    async getNumber(key: string, fallback: number): Promise<number> {
        const value = await this.get(key);
        if (value === null) return fallback;
        const num = Number(value);
        return isNaN(num) ? fallback : num;
    }

    /**
     * Get a setting as a boolean with a fallback default.
     */
    async getBool(key: string, fallback: boolean): Promise<boolean> {
        const value = await this.get(key);
        if (value === null) return fallback;
        return value === 'true' || value === '1';
    }

    /**
     * Bulk upsert settings. Input: { "snmp.defaultCommunity": "public", ... }
     */
    async bulkUpsert(settings: Record<string, string>) {
        const ops = Object.entries(settings).map(([key, value]) => {
            const category = key.split('.')[0] || 'general';
            // Update cache immediately
            this.cache.set(key, { value: String(value), expiresAt: Date.now() + this.CACHE_TTL_MS });
            return this.prisma.systemSetting.upsert({
                where: { key },
                create: { key, value: String(value), category },
                update: { value: String(value) },
            });
        });

        await this.prisma.$transaction(ops);
        return this.getAll();
    }

    /**
     * Invalidate the in-memory cache (e.g., after external DB changes).
     */
    invalidateCache() {
        this.cache.clear();
    }
}
