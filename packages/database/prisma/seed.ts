import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seeds the database with initial data needed for development
 * and the first production deployment.
 *
 * Run: npm run db:seed
 */
async function main() {
    console.log('🌱 Seeding database...');

    // ─── Default Admin User ───────────────────────────
    const adminExists = await prisma.user.findUnique({
        where: { username: 'admin' },
    });

    if (!adminExists) {
        await prisma.user.create({
            data: {
                username: 'admin',
                email: 'admin@netmon.local',
                passwordHash: await bcrypt.hash('admin', 12),
                displayName: 'Administrator',
                role: UserRole.admin,
                isActive: true,
            },
        });
        console.log('  ✓ Created admin user (admin / admin)');
    }

    // ─── Default Operator User ────────────────────────
    const operatorExists = await prisma.user.findUnique({
        where: { username: 'operator' },
    });

    if (!operatorExists) {
        await prisma.user.create({
            data: {
                username: 'operator',
                email: 'operator@netmon.local',
                passwordHash: await bcrypt.hash('operator123', 12),
                displayName: 'Network Operator',
                role: UserRole.operator,
                isActive: true,
            },
        });
        console.log('  ✓ Created operator user (operator / operator123)');
    }

    // ─── Sample Locations ─────────────────────────────
    const locations = [
        { name: 'Data Center Jakarta', code: 'DC-JKT', city: 'Jakarta', province: 'DKI Jakarta', latitude: -6.2088, longitude: 106.8456 },
        { name: 'Branch Office Bandung', code: 'BR-BDG', city: 'Bandung', province: 'Jawa Barat', latitude: -6.9175, longitude: 107.6191 },
        { name: 'Branch Office Surabaya', code: 'BR-SBY', city: 'Surabaya', province: 'Jawa Timur', latitude: -7.2575, longitude: 112.7521 },
        { name: 'Branch Office Medan', code: 'BR-MDN', city: 'Medan', province: 'Sumatra Utara', latitude: 3.5952, longitude: 98.6722 },
        { name: 'Branch Office Makassar', code: 'BR-MKS', city: 'Makassar', province: 'Sulawesi Selatan', latitude: -5.1477, longitude: 119.4327 },
    ];

    for (const loc of locations) {
        await prisma.location.upsert({
            where: { code: loc.code },
            create: loc,
            update: {},
        });
    }
    console.log('  ✓ Seeded ' + locations.length + ' locations');

    // ─── Sample Device Groups ────────────────────────
    const groups = ['Core Routers', 'Distribution Routers', 'Access Points - Indoor', 'Access Points - Outdoor'];

    for (const name of groups) {
        await prisma.deviceGroup.upsert({
            where: { name },
            create: { name },
            update: {},
        });
    }
    console.log('  ✓ Seeded ' + groups.length + ' device groups');

    // ─── Sample Alert Rules ──────────────────────────
    const alertRules = [
        { name: 'High CPU Usage', metricName: 'cpu_usage', condition: 'gt', threshold: 85, severity: 'warning' as const, duration: 300 },
        { name: 'Critical CPU Usage', metricName: 'cpu_usage', condition: 'gt', threshold: 95, severity: 'critical' as const, duration: 120 },
        { name: 'High Memory Usage', metricName: 'memory_usage', condition: 'gt', threshold: 90, severity: 'warning' as const, duration: 300 },
        { name: 'Interface Down', metricName: 'if_oper_status', condition: 'eq', threshold: 2, severity: 'critical' as const, duration: 0 },
        { name: 'High Temperature', metricName: 'temperature', condition: 'gt', threshold: 70, severity: 'warning' as const, duration: 60 },
    ];

    for (const rule of alertRules) {
        const exists = await prisma.alertRule.findFirst({
            where: { name: rule.name },
        });
        if (!exists) {
            await prisma.alertRule.create({
                data: { ...rule, notifyChannels: ['telegram'] },
            });
        }
    }
    console.log('  ✓ Seeded ' + alertRules.length + ' alert rules');

    // ─── Sample Devices ──────────────────────────────
    const dcJkt = await prisma.location.findUnique({ where: { code: 'DC-JKT' } });
    const brBdg = await prisma.location.findUnique({ where: { code: 'BR-BDG' } });

    // --- MikroTik CCR1036 Router ---
    let router = await prisma.device.findUnique({ where: { hostname: 'mikrotik-core-01' } });
    if (!router) {
        router = await prisma.device.create({
            data: {
                hostname: 'mikrotik-core-01',
                ipAddress: '192.168.1.1',
                displayName: 'MikroTik CCR1036 - Core Router',
                deviceType: 'router',
                vendor: 'MikroTik',
                model: 'CCR1036-8G-2S+',
                osVersion: 'RouterOS v7.14.3',
                serialNumber: 'HFG309TB2K7',
                sysObjectId: '1.3.6.1.4.1.14988.1',
                status: 'up',
                uptime: BigInt(8640000),
                snmpVersion: 'v2c',
                snmpCommunity: 'public',
                snmpPort: 161,
                pollingEnabled: true,
                pollingInterval: 60,
                lastPolledAt: new Date(),
                lastDiscoveredAt: new Date(),
                locationId: dcJkt?.id,
            },
        });

        const routerIfaces = [
            { ifIndex: 1, ifName: 'ether1-WAN', ifDescr: 'WAN Uplink (ISP)', ifAlias: 'WAN Primary', ifType: 'ethernetCsmacd', ifSpeed: BigInt(1000000000), ifHighSpeed: BigInt(1000), ifPhysAddress: 'E4:8D:8C:3A:B1:01', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 2, ifName: 'ether2-LAN', ifDescr: 'LAN Trunk to Switch', ifAlias: 'LAN Core', ifType: 'ethernetCsmacd', ifSpeed: BigInt(1000000000), ifHighSpeed: BigInt(1000), ifPhysAddress: 'E4:8D:8C:3A:B1:02', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 3, ifName: 'ether3-MGMT', ifDescr: 'Management Network', ifAlias: 'Management', ifType: 'ethernetCsmacd', ifSpeed: BigInt(1000000000), ifHighSpeed: BigInt(1000), ifPhysAddress: 'E4:8D:8C:3A:B1:03', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 4, ifName: 'ether4', ifDescr: 'Ethernet Port 4', ifAlias: 'Unused', ifType: 'ethernetCsmacd', ifSpeed: BigInt(1000000000), ifHighSpeed: BigInt(1000), ifPhysAddress: 'E4:8D:8C:3A:B1:04', ifAdminStatus: 'down', ifOperStatus: 'down' },
            { ifIndex: 5, ifName: 'sfp-sfpplus1', ifDescr: 'SFP+ Uplink', ifAlias: 'SFP+ to DC Switch', ifType: 'ethernetCsmacd', ifSpeed: BigInt(10000000000), ifHighSpeed: BigInt(10000), ifPhysAddress: 'E4:8D:8C:3A:B1:09', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 6, ifName: 'bridge-LAN', ifDescr: 'Bridge LAN', ifAlias: 'Bridge', ifType: 'bridge', ifSpeed: BigInt(0), ifHighSpeed: BigInt(0), ifPhysAddress: 'E4:8D:8C:3A:B1:FF', ifAdminStatus: 'up', ifOperStatus: 'up' },
        ];
        for (const iface of routerIfaces) {
            await prisma.interface.create({ data: { deviceId: router.id, ...iface } });
        }
        console.log('  ✓ Created MikroTik CCR1036 router with 6 interfaces');
    }

    // --- Ubiquiti UAP-AC-PRO #1 (Lobby) ---
    let ap1 = await prisma.device.findUnique({ where: { hostname: 'ubnt-ap-lobby-01' } });
    if (!ap1) {
        ap1 = await prisma.device.create({
            data: {
                hostname: 'ubnt-ap-lobby-01',
                ipAddress: '192.168.1.10',
                displayName: 'Ubiquiti AP Lobby - Lantai 1',
                deviceType: 'access_point',
                vendor: 'Ubiquiti',
                model: 'UAP-AC-PRO',
                osVersion: 'UniFi 6.6.65',
                serialNumber: 'FCECDA7B2E01',
                sysObjectId: '1.3.6.1.4.1.41112.1.6',
                status: 'up',
                uptime: BigInt(4320000),
                snmpVersion: 'v2c',
                snmpCommunity: 'public',
                snmpPort: 161,
                pollingEnabled: true,
                pollingInterval: 120,
                lastPolledAt: new Date(),
                lastDiscoveredAt: new Date(),
                locationId: dcJkt?.id,
            },
        });

        const ap1Ifaces = [
            { ifIndex: 1, ifName: 'eth0', ifDescr: 'Ethernet LAN', ifAlias: 'PoE Uplink', ifType: 'ethernetCsmacd', ifSpeed: BigInt(1000000000), ifHighSpeed: BigInt(1000), ifPhysAddress: 'FC:EC:DA:7B:2E:01', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 2, ifName: 'ath0', ifDescr: 'WiFi 2.4GHz Radio', ifAlias: 'SSID: NetMon-Office', ifType: 'ieee80211', ifSpeed: BigInt(450000000), ifHighSpeed: BigInt(450), ifPhysAddress: 'FC:EC:DA:7B:2E:02', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 3, ifName: 'ath1', ifDescr: 'WiFi 5GHz Radio', ifAlias: 'SSID: NetMon-Office-5G', ifType: 'ieee80211', ifSpeed: BigInt(1300000000), ifHighSpeed: BigInt(1300), ifPhysAddress: 'FC:EC:DA:7B:2E:03', ifAdminStatus: 'up', ifOperStatus: 'up' },
        ];
        for (const iface of ap1Ifaces) {
            await prisma.interface.create({ data: { deviceId: ap1.id, ...iface } });
        }
        console.log('  ✓ Created Ubiquiti AP Lobby #1 with 3 interfaces');
    }

    // --- Ubiquiti UAP-AC-PRO #2 (Office Floor 2) ---
    let ap2 = await prisma.device.findUnique({ where: { hostname: 'ubnt-ap-office-02' } });
    if (!ap2) {
        ap2 = await prisma.device.create({
            data: {
                hostname: 'ubnt-ap-office-02',
                ipAddress: '192.168.1.11',
                displayName: 'Ubiquiti AP Office - Lantai 2',
                deviceType: 'access_point',
                vendor: 'Ubiquiti',
                model: 'UAP-AC-PRO',
                osVersion: 'UniFi 6.6.65',
                serialNumber: 'FCECDA7B2E42',
                sysObjectId: '1.3.6.1.4.1.41112.1.6',
                status: 'up',
                uptime: BigInt(4320000),
                snmpVersion: 'v2c',
                snmpCommunity: 'public',
                snmpPort: 161,
                pollingEnabled: true,
                pollingInterval: 120,
                lastPolledAt: new Date(),
                lastDiscoveredAt: new Date(),
                locationId: brBdg?.id,
            },
        });

        const ap2Ifaces = [
            { ifIndex: 1, ifName: 'eth0', ifDescr: 'Ethernet LAN', ifAlias: 'PoE Uplink', ifType: 'ethernetCsmacd', ifSpeed: BigInt(1000000000), ifHighSpeed: BigInt(1000), ifPhysAddress: 'FC:EC:DA:7B:2E:42', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 2, ifName: 'ath0', ifDescr: 'WiFi 2.4GHz Radio', ifAlias: 'SSID: NetMon-Office', ifType: 'ieee80211', ifSpeed: BigInt(450000000), ifHighSpeed: BigInt(450), ifPhysAddress: 'FC:EC:DA:7B:2E:43', ifAdminStatus: 'up', ifOperStatus: 'up' },
            { ifIndex: 3, ifName: 'ath1', ifDescr: 'WiFi 5GHz Radio', ifAlias: 'SSID: NetMon-Office-5G', ifType: 'ieee80211', ifSpeed: BigInt(1300000000), ifHighSpeed: BigInt(1300), ifPhysAddress: 'FC:EC:DA:7B:2E:44', ifAdminStatus: 'up', ifOperStatus: 'up' },
        ];
        for (const iface of ap2Ifaces) {
            await prisma.interface.create({ data: { deviceId: ap2.id, ...iface } });
        }
        console.log('  ✓ Created Ubiquiti AP Office #2 with 3 interfaces');
    }

    // ─── Device Group Membership ────────────────────
    const coreRouters = await prisma.deviceGroup.findUnique({ where: { name: 'Core Routers' } });
    const apIndoor = await prisma.deviceGroup.findUnique({ where: { name: 'Access Points - Indoor' } });

    if (coreRouters && router) {
        await prisma.deviceGroupMember.upsert({
            where: { groupId_deviceId: { groupId: coreRouters.id, deviceId: router.id } },
            create: { groupId: coreRouters.id, deviceId: router.id },
            update: {},
        });
    }
    if (apIndoor && ap1) {
        await prisma.deviceGroupMember.upsert({
            where: { groupId_deviceId: { groupId: apIndoor.id, deviceId: ap1.id } },
            create: { groupId: apIndoor.id, deviceId: ap1.id },
            update: {},
        });
    }
    if (apIndoor && ap2) {
        await prisma.deviceGroupMember.upsert({
            where: { groupId_deviceId: { groupId: apIndoor.id, deviceId: ap2.id } },
            create: { groupId: apIndoor.id, deviceId: ap2.id },
            update: {},
        });
    }
    console.log('  ✓ Assigned devices to groups');

    // ─── Sample Alert History ────────────────────────
    const highCpuRule = await prisma.alertRule.findFirst({ where: { name: 'High CPU Usage' } });
    const ifDownRule = await prisma.alertRule.findFirst({ where: { name: 'Interface Down' } });

    const existingAlerts = await prisma.alertHistory.count();
    if (existingAlerts === 0 && highCpuRule && ifDownRule && router && ap1) {
        const now = new Date();
        await prisma.alertHistory.createMany({
            data: [
                {
                    deviceId: router.id,
                    ruleId: highCpuRule.id,
                    severity: 'warning',
                    state: 'resolved',
                    message: 'CPU usage exceeded 85% on MikroTik CCR1036 (peak: 92%)',
                    metricValue: 92.3,
                    triggeredAt: new Date(now.getTime() - 86400000),
                    resolvedAt: new Date(now.getTime() - 82800000),
                },
                {
                    deviceId: router.id,
                    ruleId: highCpuRule.id,
                    severity: 'warning',
                    state: 'resolved',
                    message: 'CPU usage exceeded 85% on MikroTik CCR1036 (peak: 88%)',
                    metricValue: 88.1,
                    triggeredAt: new Date(now.getTime() - 172800000),
                    resolvedAt: new Date(now.getTime() - 169200000),
                },
                {
                    deviceId: ap1.id,
                    ruleId: ifDownRule.id,
                    severity: 'critical',
                    state: 'resolved',
                    message: 'Interface ath0 (WiFi 2.4GHz) went down on ubnt-ap-lobby-01',
                    metricValue: 2,
                    triggeredAt: new Date(now.getTime() - 259200000),
                    resolvedAt: new Date(now.getTime() - 255600000),
                },
                {
                    deviceId: router.id,
                    ruleId: ifDownRule.id,
                    severity: 'critical',
                    state: 'acknowledged',
                    message: 'Interface ether4 is operationally down on mikrotik-core-01',
                    metricValue: 2,
                    triggeredAt: new Date(now.getTime() - 7200000),
                    acknowledgedAt: new Date(now.getTime() - 3600000),
                    acknowledgedBy: 1,
                },
            ],
        });
        console.log('  ✓ Created 4 sample alert history entries');
    }

    // ─── Sample Polling Jobs ────────────────────────
    const existingJobs = await prisma.pollingJob.count();
    if (existingJobs === 0 && router && ap1 && ap2) {
        const now = new Date();
        await prisma.pollingJob.createMany({
            data: [
                { deviceId: router.id, jobType: 'snmp_poll', status: 'completed', startedAt: new Date(now.getTime() - 60000), completedAt: new Date(now.getTime() - 58500), duration: 1500 },
                { deviceId: router.id, jobType: 'snmp_poll', status: 'completed', startedAt: new Date(now.getTime() - 120000), completedAt: new Date(now.getTime() - 118200), duration: 1800 },
                { deviceId: ap1.id, jobType: 'snmp_poll', status: 'completed', startedAt: new Date(now.getTime() - 60000), completedAt: new Date(now.getTime() - 59000), duration: 1000 },
                { deviceId: ap2.id, jobType: 'snmp_poll', status: 'completed', startedAt: new Date(now.getTime() - 60000), completedAt: new Date(now.getTime() - 58800), duration: 1200 },
            ],
        });
        console.log('  ✓ Created sample polling jobs');
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

    // ─── Sample Audit Log Entries ────────────────────
    const existingAuditLogs = await prisma.auditLog.count();
    if (existingAuditLogs === 0) {
        const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
        const now = new Date();
        const entries = [
            {
                userId: admin?.id ?? null,
                action: 'login_success',
                entity: 'auth',
                details: { username: 'admin' },
                ipAddress: '10.10.0.100',
                createdAt: new Date(now.getTime() - 300000),
            },
            {
                userId: null,
                action: 'login_failed',
                entity: 'auth',
                details: { username: 'root', reason: 'User not found' },
                ipAddress: '45.33.32.156',
                createdAt: new Date(now.getTime() - 900000),
            },
            {
                userId: null,
                action: 'login_failed',
                entity: 'auth',
                details: { username: 'test', reason: 'User not found' },
                ipAddress: '203.0.113.42',
                createdAt: new Date(now.getTime() - 3600000),
            },
            {
                userId: admin?.id ?? null,
                action: 'login_success',
                entity: 'auth',
                details: { username: 'admin' },
                ipAddress: '10.10.0.100',
                createdAt: new Date(now.getTime() - 7200000),
            },
            {
                userId: null,
                action: 'login_failed',
                entity: 'auth',
                details: { username: 'admin', reason: 'Invalid password' },
                ipAddress: '198.51.100.23',
                createdAt: new Date(now.getTime() - 21600000),
            },
            {
                userId: admin?.id ?? null,
                action: 'settings_update',
                entity: 'settings',
                details: { keys: ['snmp.defaultCommunity', 'polling.defaultInterval'] },
                ipAddress: '10.10.0.100',
                createdAt: new Date(now.getTime() - 43200000),
            },
        ];

        for (const entry of entries) {
            await prisma.auditLog.create({ data: entry });
        }
        console.log('  ✓ Created ' + entries.length + ' sample audit log entries');
    }

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

