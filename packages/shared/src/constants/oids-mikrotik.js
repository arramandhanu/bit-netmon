"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIKROTIK_SYS_OBJECT_PREFIX = exports.MIKROTIK_OIDS = void 0;
/**
 * MikroTik-specific enterprise OIDs
 *
 * Enterprise base: 1.3.6.1.4.1.14988 (MikroTik)
 *
 * Reference:
 * - MIKROTIK-MIB: System health, CPU, memory, temperature
 * - mtxrWireless: Wireless interface statistics
 */
exports.MIKROTIK_OIDS = {
    cpu: {
        mtxrHlProcessorLoad: '1.3.6.1.4.1.14988.1.1.3.14.0',
    },
    memory: {
        mtxrHlTotalMemory: '1.3.6.1.4.1.14988.1.1.3.12.0',
        mtxrHlTotalUsedMemory: '1.3.6.1.4.1.14988.1.1.3.13.0',
    },
    temperature: {
        mtxrHlTemperature: '1.3.6.1.4.1.14988.1.1.3.10.0',
        mtxrHlProcessorTemperature: '1.3.6.1.4.1.14988.1.1.3.11.0',
    },
    wireless: {
        mtxrWlApClientCount: '1.3.6.1.4.1.14988.1.1.1.3.1.6',
        mtxrWlApSsid: '1.3.6.1.4.1.14988.1.1.1.3.1.4',
        mtxrWlApBand: '1.3.6.1.4.1.14988.1.1.1.3.1.8',
        mtxrWlApNoiseFloor: '1.3.6.1.4.1.14988.1.1.1.3.1.9',
    },
    system: {
        mtxrFirmwareVersion: '1.3.6.1.4.1.14988.1.1.4.4.0',
        mtxrSerialNumber: '1.3.6.1.4.1.14988.1.1.7.3.0',
        mtxrBoardName: '1.3.6.1.4.1.14988.1.1.7.8.0',
    },
};
/** Known MikroTik sysObjectID prefix */
exports.MIKROTIK_SYS_OBJECT_PREFIX = '1.3.6.1.4.1.14988.1';
//# sourceMappingURL=oids-mikrotik.js.map