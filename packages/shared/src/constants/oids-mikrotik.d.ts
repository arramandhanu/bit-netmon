/**
 * MikroTik-specific enterprise OIDs
 *
 * Enterprise base: 1.3.6.1.4.1.14988 (MikroTik)
 *
 * Reference:
 * - MIKROTIK-MIB: System health, CPU, memory, temperature
 * - mtxrWireless: Wireless interface statistics
 */
export declare const MIKROTIK_OIDS: {
    readonly cpu: {
        readonly mtxrHlProcessorLoad: "1.3.6.1.4.1.14988.1.1.3.14.0";
    };
    readonly memory: {
        readonly mtxrHlTotalMemory: "1.3.6.1.4.1.14988.1.1.3.12.0";
        readonly mtxrHlTotalUsedMemory: "1.3.6.1.4.1.14988.1.1.3.13.0";
    };
    readonly temperature: {
        readonly mtxrHlTemperature: "1.3.6.1.4.1.14988.1.1.3.10.0";
        readonly mtxrHlProcessorTemperature: "1.3.6.1.4.1.14988.1.1.3.11.0";
    };
    readonly wireless: {
        readonly mtxrWlApClientCount: "1.3.6.1.4.1.14988.1.1.1.3.1.6";
        readonly mtxrWlApSsid: "1.3.6.1.4.1.14988.1.1.1.3.1.4";
        readonly mtxrWlApBand: "1.3.6.1.4.1.14988.1.1.1.3.1.8";
        readonly mtxrWlApNoiseFloor: "1.3.6.1.4.1.14988.1.1.1.3.1.9";
    };
    readonly system: {
        readonly mtxrFirmwareVersion: "1.3.6.1.4.1.14988.1.1.4.4.0";
        readonly mtxrSerialNumber: "1.3.6.1.4.1.14988.1.1.7.3.0";
        readonly mtxrBoardName: "1.3.6.1.4.1.14988.1.1.7.8.0";
    };
};
/** Known MikroTik sysObjectID prefix */
export declare const MIKROTIK_SYS_OBJECT_PREFIX: "1.3.6.1.4.1.14988.1";
//# sourceMappingURL=oids-mikrotik.d.ts.map