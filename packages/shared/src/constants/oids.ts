/**
 * Standard MIB-II OIDs (RFC 1213)
 *
 * These work on any device that implements SNMP correctly.
 * Append `.0` for scalar values, or walk the table OID for tabular data.
 */
export const SYSTEM_OIDS = {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysContact: '1.3.6.1.2.1.1.4.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
    sysServices: '1.3.6.1.2.1.1.7.0',
} as const;

/**
 * IF-MIB (RFC 2863) — Interface table
 *
 * These are table OIDs. Append `.ifIndex` to get a specific interface,
 * or walk the base OID to enumerate all interfaces on the device.
 */
export const IF_TABLE_OIDS = {
    ifNumber: '1.3.6.1.2.1.2.1.0',
    ifDescr: '1.3.6.1.2.1.2.2.1.2',
    ifType: '1.3.6.1.2.1.2.2.1.3',
    ifMtu: '1.3.6.1.2.1.2.2.1.4',
    ifSpeed: '1.3.6.1.2.1.2.2.1.5',
    ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
    ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
    ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
    ifInOctets: '1.3.6.1.2.1.2.2.1.10',
    ifInUcastPkts: '1.3.6.1.2.1.2.2.1.11',
    ifInErrors: '1.3.6.1.2.1.2.2.1.14',
    ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
    ifOutUcastPkts: '1.3.6.1.2.1.2.2.1.17',
    ifOutErrors: '1.3.6.1.2.1.2.2.1.20',
} as const;

/**
 * IF-MIB Extensions (RFC 2863) — High-capacity 64-bit counters
 *
 * Critical for 1Gbps+ links where 32-bit counters wrap every ~34 seconds.
 * Only available on SNMPv2c and v3.
 */
export const IF_XTABLE_OIDS = {
    ifName: '1.3.6.1.2.1.31.1.1.1.1',
    ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15',
    ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',
    ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10',
    ifHCInUcastPkts: '1.3.6.1.2.1.31.1.1.1.7',
    ifHCOutUcastPkts: '1.3.6.1.2.1.31.1.1.1.11',
    ifAlias: '1.3.6.1.2.1.31.1.1.1.18',
} as const;

/**
 * HOST-RESOURCES-MIB (RFC 2790) — Generic CPU/Memory
 *
 * Fallback for devices that don't support vendor-specific OIDs.
 */
export const HOST_RESOURCES_OIDS = {
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
    hrStorageAllocationUnits: '1.3.6.1.2.1.25.2.3.1.4',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
} as const;

/**
 * LLDP-MIB (IEEE 802.1AB) — Link Layer Discovery Protocol
 *
 * Multi-vendor neighbor discovery. Preferred over CDP for non-Cisco gear.
 */
export const LLDP_OIDS = {
    lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9',
    lldpRemSysDesc: '1.0.8802.1.1.2.1.4.1.1.10',
    lldpRemPortId: '1.0.8802.1.1.2.1.4.1.1.7',
    lldpRemPortDesc: '1.0.8802.1.1.2.1.4.1.1.8',
    lldpRemManAddr: '1.0.8802.1.1.2.1.4.2.1.4',
} as const;
