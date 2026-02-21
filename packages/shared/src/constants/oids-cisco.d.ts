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
export declare const CISCO_OIDS: {
    readonly cpu: {
        readonly cpmCPUTotal1minRev: "1.3.6.1.4.1.9.9.109.1.1.1.1.7";
        readonly cpmCPUTotal5minRev: "1.3.6.1.4.1.9.9.109.1.1.1.1.8";
    };
    readonly memory: {
        readonly ciscoMemoryPoolUsed: "1.3.6.1.4.1.9.9.48.1.1.1.5";
        readonly ciscoMemoryPoolFree: "1.3.6.1.4.1.9.9.48.1.1.1.6";
    };
    readonly temperature: {
        readonly envMonTempStatusDescr: "1.3.6.1.4.1.9.9.13.1.3.1.2";
        readonly envMonTempStatusValue: "1.3.6.1.4.1.9.9.13.1.3.1.3";
        readonly envMonTempThreshold: "1.3.6.1.4.1.9.9.13.1.3.1.4";
    };
    readonly wireless: {
        readonly bsnAPIfLoadNumOfClients: "1.3.6.1.4.1.14179.2.2.13.1.4";
        readonly bsnAPIfLoadChannelUtilization: "1.3.6.1.4.1.14179.2.2.13.1.3";
    };
    readonly cdp: {
        readonly cdpCacheAddress: "1.3.6.1.4.1.9.9.23.1.2.1.1.4";
        readonly cdpCacheDeviceId: "1.3.6.1.4.1.9.9.23.1.2.1.1.6";
        readonly cdpCacheDevicePort: "1.3.6.1.4.1.9.9.23.1.2.1.1.7";
        readonly cdpCachePlatform: "1.3.6.1.4.1.9.9.23.1.2.1.1.8";
    };
};
/** Known Cisco sysObjectID prefixes used for device classification */
export declare const CISCO_SYS_OBJECT_PREFIXES: readonly ["1.3.6.1.4.1.9.1.", "1.3.6.1.4.1.9.6.", "1.3.6.1.4.1.9.12."];
//# sourceMappingURL=oids-cisco.d.ts.map