/**
 * Standard MIB-II OIDs (RFC 1213)
 *
 * These work on any device that implements SNMP correctly.
 * Append `.0` for scalar values, or walk the table OID for tabular data.
 */
export declare const SYSTEM_OIDS: {
    readonly sysDescr: "1.3.6.1.2.1.1.1.0";
    readonly sysObjectID: "1.3.6.1.2.1.1.2.0";
    readonly sysUpTime: "1.3.6.1.2.1.1.3.0";
    readonly sysContact: "1.3.6.1.2.1.1.4.0";
    readonly sysName: "1.3.6.1.2.1.1.5.0";
    readonly sysLocation: "1.3.6.1.2.1.1.6.0";
    readonly sysServices: "1.3.6.1.2.1.1.7.0";
};
/**
 * IF-MIB (RFC 2863) — Interface table
 *
 * These are table OIDs. Append `.ifIndex` to get a specific interface,
 * or walk the base OID to enumerate all interfaces on the device.
 */
export declare const IF_TABLE_OIDS: {
    readonly ifNumber: "1.3.6.1.2.1.2.1.0";
    readonly ifDescr: "1.3.6.1.2.1.2.2.1.2";
    readonly ifType: "1.3.6.1.2.1.2.2.1.3";
    readonly ifMtu: "1.3.6.1.2.1.2.2.1.4";
    readonly ifSpeed: "1.3.6.1.2.1.2.2.1.5";
    readonly ifPhysAddress: "1.3.6.1.2.1.2.2.1.6";
    readonly ifAdminStatus: "1.3.6.1.2.1.2.2.1.7";
    readonly ifOperStatus: "1.3.6.1.2.1.2.2.1.8";
    readonly ifInOctets: "1.3.6.1.2.1.2.2.1.10";
    readonly ifInUcastPkts: "1.3.6.1.2.1.2.2.1.11";
    readonly ifInErrors: "1.3.6.1.2.1.2.2.1.14";
    readonly ifOutOctets: "1.3.6.1.2.1.2.2.1.16";
    readonly ifOutUcastPkts: "1.3.6.1.2.1.2.2.1.17";
    readonly ifOutErrors: "1.3.6.1.2.1.2.2.1.20";
};
/**
 * IF-MIB Extensions (RFC 2863) — High-capacity 64-bit counters
 *
 * Critical for 1Gbps+ links where 32-bit counters wrap every ~34 seconds.
 * Only available on SNMPv2c and v3.
 */
export declare const IF_XTABLE_OIDS: {
    readonly ifName: "1.3.6.1.2.1.31.1.1.1.1";
    readonly ifHighSpeed: "1.3.6.1.2.1.31.1.1.1.15";
    readonly ifHCInOctets: "1.3.6.1.2.1.31.1.1.1.6";
    readonly ifHCOutOctets: "1.3.6.1.2.1.31.1.1.1.10";
    readonly ifHCInUcastPkts: "1.3.6.1.2.1.31.1.1.1.7";
    readonly ifHCOutUcastPkts: "1.3.6.1.2.1.31.1.1.1.11";
    readonly ifAlias: "1.3.6.1.2.1.31.1.1.1.18";
};
/**
 * HOST-RESOURCES-MIB (RFC 2790) — Generic CPU/Memory
 *
 * Fallback for devices that don't support vendor-specific OIDs.
 */
export declare const HOST_RESOURCES_OIDS: {
    readonly hrProcessorLoad: "1.3.6.1.2.1.25.3.3.1.2";
    readonly hrStorageDescr: "1.3.6.1.2.1.25.2.3.1.3";
    readonly hrStorageAllocationUnits: "1.3.6.1.2.1.25.2.3.1.4";
    readonly hrStorageSize: "1.3.6.1.2.1.25.2.3.1.5";
    readonly hrStorageUsed: "1.3.6.1.2.1.25.2.3.1.6";
};
/**
 * LLDP-MIB (IEEE 802.1AB) — Link Layer Discovery Protocol
 *
 * Multi-vendor neighbor discovery. Preferred over CDP for non-Cisco gear.
 */
export declare const LLDP_OIDS: {
    readonly lldpRemSysName: "1.0.8802.1.1.2.1.4.1.1.9";
    readonly lldpRemSysDesc: "1.0.8802.1.1.2.1.4.1.1.10";
    readonly lldpRemPortId: "1.0.8802.1.1.2.1.4.1.1.7";
    readonly lldpRemPortDesc: "1.0.8802.1.1.2.1.4.1.1.8";
    readonly lldpRemManAddr: "1.0.8802.1.1.2.1.4.2.1.4";
};
//# sourceMappingURL=oids.d.ts.map