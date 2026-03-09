import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@netmon.local';

/**
 * Seeds the database with essential data only:
 *   - Default admin user
 *   - Default system settings
 *
 * Run: npm run db:seed
 */
async function main() {
    console.log('🌱 Seeding database...');

    // ─── Default Admin User ───────────────────────────
    const adminExists = await prisma.user.findUnique({
        where: { username: ADMIN_USERNAME },
    });

    if (!adminExists) {
        await prisma.user.create({
            data: {
                username: ADMIN_USERNAME,
                email: ADMIN_EMAIL,
                passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
                displayName: 'Administrator',
                role: UserRole.admin,
                isActive: true,
            },
        });
        console.log(`  ✓ Created admin user (${ADMIN_USERNAME} / ${ADMIN_PASSWORD})`);
    } else {
        console.log(`  ✓ Admin user already exists (${ADMIN_USERNAME})`);
    }

    // ─── Default System Settings ────────────────────
    const defaultSettings: { key: string; value: string; category: string }[] = [
        // SNMP
        { key: 'snmp.defaultCommunity', value: 'public', category: 'snmp' },
        { key: 'snmp.defaultVersion', value: 'v2c', category: 'snmp' },
        { key: 'snmp.timeout', value: '5000', category: 'snmp' },
        { key: 'snmp.retries', value: '2', category: 'snmp' },
        // Polling
        { key: 'polling.defaultInterval', value: '300', category: 'polling' },
        { key: 'polling.concurrentPolls', value: '10', category: 'polling' },
        // Notification
        { key: 'notification.telegramBotToken', value: '', category: 'notification' },
        { key: 'notification.telegramChatId', value: '', category: 'notification' },
        { key: 'notification.smtpHost', value: '', category: 'notification' },
        { key: 'notification.smtpPort', value: '587', category: 'notification' },
        { key: 'notification.smtpUsername', value: '', category: 'notification' },
        { key: 'notification.smtpPassword', value: '', category: 'notification' },
        { key: 'notification.webhookUrl', value: '', category: 'notification' },
        // Security
        { key: 'security.jwtExpiry', value: '24h', category: 'security' },
        { key: 'security.maxLoginAttempts', value: '5', category: 'security' },
    ];

    for (const setting of defaultSettings) {
        await prisma.systemSetting.upsert({
            where: { key: setting.key },
            create: setting,
            update: {},
        });
    }
    console.log('  ✓ Seeded ' + defaultSettings.length + ' default system settings');

    console.log('\n✅ Seeding complete');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
