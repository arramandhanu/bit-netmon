"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CISCO_SYS_OBJECT_PREFIXES = exports.CISCO_OIDS = void 0;
/**
 * Cisco-specific enterprise OIDs
 *
 * Enterprise base: 1.3.6.1.4.1.9 (Cisco Systems)
 *
 * Reference:
 * - CISCO-PROCESS-MIB: CPU utilization
 * - CISCO-MEMORY-POOL-MIB: Memory usage
 * - CISCO-ENVMON-MIB: Temperature sensors
 * - AIRESPACE-WIRELESS-MIB: Wireless controller stats
 */
exports.CISCO_OIDS = {
    cpu: {
        cpmCPUTotal1minRev: '1.3.6.1.4.1.9.9.109.1.1.1.1.7',
        cpmCPUTotal5minRev: '1.3.6.1.4.1.9.9.109.1.1.1.1.8',
    },
    memory: {
        ciscoMemoryPoolUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5',
        ciscoMemoryPoolFree: '1.3.6.1.4.1.9.9.48.1.1.1.6',
    },
    temperature: {
        envMonTempStatusDescr: '1.3.6.1.4.1.9.9.13.1.3.1.2',
        envMonTempStatusValue: '1.3.6.1.4.1.9.9.13.1.3.1.3',
        envMonTempThreshold: '1.3.6.1.4.1.9.9.13.1.3.1.4',
    },
    wireless: {
        bsnAPIfLoadNumOfClients: '1.3.6.1.4.1.14179.2.2.13.1.4',
        bsnAPIfLoadChannelUtilization: '1.3.6.1.4.1.14179.2.2.13.1.3',
    },
    cdp: {
        cdpCacheAddress: '1.3.6.1.4.1.9.9.23.1.2.1.1.4',
        cdpCacheDeviceId: '1.3.6.1.4.1.9.9.23.1.2.1.1.6',
        cdpCacheDevicePort: '1.3.6.1.4.1.9.9.23.1.2.1.1.7',
        cdpCachePlatform: '1.3.6.1.4.1.9.9.23.1.2.1.1.8',
    },
};
/** Known Cisco sysObjectID prefixes used for device classification */
exports.CISCO_SYS_OBJECT_PREFIXES = [
    '1.3.6.1.4.1.9.1.', // Cisco IOS devices
    '1.3.6.1.4.1.9.6.', // Cisco Catalyst
    '1.3.6.1.4.1.9.12.', // Cisco ASR/Nexus
];
//# sourceMappingURL=oids-cisco.js.map