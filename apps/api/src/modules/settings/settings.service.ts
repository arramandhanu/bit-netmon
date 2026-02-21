import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SettingsService {

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

        // Convert to a flat key-value map grouped by category
        const grouped: Record<string, Record<string, string>> = {};
        for (const row of rows) {
            if (!grouped[row.category]) grouped[row.category] = {};
            grouped[row.category][row.key] = row.value;
        }
        return grouped;
    }

    /**
     * Get a single setting by key.
     */
    async get(key: string): Promise<string | null> {
        const row = await this.prisma.systemSetting.findUnique({ where: { key } });
        return row?.value ?? null;
    }

    /**
     * Bulk upsert settings. Input: { "snmp.defaultCommunity": "public", ... }
     */
    async bulkUpsert(settings: Record<string, string>) {
        const ops = Object.entries(settings).map(([key, value]) => {
            const category = key.split('.')[0] || 'general';
            return this.prisma.systemSetting.upsert({
                where: { key },
                create: { key, value: String(value), category },
                update: { value: String(value) },
            });
        });

        await this.prisma.$transaction(ops);
        return this.getAll();
    }
}
