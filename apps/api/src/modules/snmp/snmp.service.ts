import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as snmp from 'net-snmp';
import {
    SYSTEM_OIDS,
    IF_TABLE_OIDS,
    IF_XTABLE_OIDS,
} from '@netmon/shared';
import { SettingsService } from '../settings/settings.service';

export interface SnmpTarget {
    host: string;
    port?: number;
    version: 'v1' | 'v2c' | 'v3';
    community?: string;
    v3User?: string;
    v3AuthProto?: string;
    v3AuthPass?: string;
    v3PrivProto?: string;
    v3PrivPass?: string;
    timeout?: number;
    retries?: number;
}

export interface SystemInfo {
    sysDescr: string;
    sysObjectID: string;
    sysUpTime: number;
    sysName: string;
    sysLocation: string;
    sysContact: string;
}

export interface InterfaceInfo {
    ifIndex: number;
    ifDescr: string;
    ifName: string;
    ifAlias: string;
    ifType: number;
    ifSpeed: number;
    ifHighSpeed: number;
    ifMtu: number;
    ifPhysAddress: string;
    ifAdminStatus: number;
    ifOperStatus: number;
    ifInOctets: number;
    ifOutOctets: number;
    ifInErrors: number;
    ifOutErrors: number;
}

@Injectable()
export class SnmpService {
    private readonly logger = new Logger(SnmpService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly settings: SettingsService,
    ) { }

    /**
     * Create a net-snmp session for the given target.
     * Caller MUST close the session when done.
     */
    private async createSession(target: SnmpTarget): Promise<snmp.Session> {
        const timeoutCfg = this.config.get<number>('snmp.defaultTimeout', 5000);
        const retriesCfg = this.config.get<number>('snmp.defaultRetries', 1);

        const timeout = target.timeout || await this.settings.getNumber('snmp.timeout', timeoutCfg);
        const retries = target.retries || await this.settings.getNumber('snmp.retries', retriesCfg);
        const port = target.port || await this.settings.getNumber('snmp.port', 161);

        if (target.version === 'v3') {
            const user: any = { name: target.v3User || '' };

            // Determine security level
            let level = snmp.SecurityLevel.noAuthNoPriv;

            if (target.v3AuthProto && target.v3AuthPass) {
                level = snmp.SecurityLevel.authNoPriv;
                user.level = level;
                user.authProtocol = this.mapAuthProtocol(target.v3AuthProto);
                user.authKey = target.v3AuthPass;

                if (target.v3PrivProto && target.v3PrivPass) {
                    level = snmp.SecurityLevel.authPriv;
                    user.level = level;
                    user.privProtocol = this.mapPrivProtocol(target.v3PrivProto);
                    user.privKey = target.v3PrivPass;
                }
            }

            return snmp.createV3Session(target.host, user, {
                port,
                timeout,
                retries,
            });
        }

        // v1 or v2c
        const version = target.version === 'v1'
            ? snmp.Version1
            : snmp.Version2c;

        const defaultCommunity = await this.settings.getString('snmp.defaultCommunity', 'public');

        return snmp.createSession(target.host, target.community || defaultCommunity, {
            port,
            version,
            timeout,
            retries,
        });
    }

    private mapAuthProtocol(proto: string): number {
        switch (proto.toUpperCase()) {
            case 'SHA': return snmp.AuthProtocols.sha;
            case 'SHA256': return snmp.AuthProtocols.sha256 || snmp.AuthProtocols.sha;
            case 'MD5':
            default: return snmp.AuthProtocols.md5;
        }
    }

    private mapPrivProtocol(proto: string): number {
        switch (proto.toUpperCase()) {
            case 'AES': return snmp.PrivProtocols.aes;
            case 'AES256': return snmp.PrivProtocols.aes256b || snmp.PrivProtocols.aes;
            case 'DES':
            default: return snmp.PrivProtocols.des;
        }
    }

    /**
     * SNMP GET — fetch one or more OIDs
     */
    async get(target: SnmpTarget, oids: string[]): Promise<Map<string, any>> {
        const session = await this.createSession(target);
        try {
            return await new Promise<Map<string, any>>((resolve, reject) => {
                session.get(oids, (error: Error | null, varbinds: any[]) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    const result = new Map<string, any>();
                    for (const vb of varbinds) {
                        if (snmp.isVarbindError(vb)) {
                            result.set(vb.oid, null);
                        } else {
                            result.set(vb.oid, this.parseVarbindValue(vb));
                        }
                    }
                    resolve(result);
                });
            });
        } catch (err) {
            this.logger.error(`SNMP GET failed for ${target.host}: ${err}`);
            throw err;
        } finally {
            session.close();
        }
    }

    /**
     * SNMP subtree walk — enumerate all OIDs under a base OID
     */
    async walk(target: SnmpTarget, baseOid: string): Promise<Map<string, any>> {
        const session = await this.createSession(target);
        const result = new Map<string, any>();

        try {
            return await new Promise<Map<string, any>>((resolve, reject) => {
                session.subtree(
                    baseOid,
                    (varbinds: any[]) => {
                        for (const vb of varbinds) {
                            if (!snmp.isVarbindError(vb)) {
                                result.set(vb.oid, this.parseVarbindValue(vb));
                            }
                        }
                    },
                    (error: Error | null) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    },
                );
            });
        } catch (err) {
            this.logger.error(`SNMP walk failed for ${target.host} OID=${baseOid}: ${err}`);
            throw err;
        } finally {
            session.close();
        }
    }

    /**
     * Quick connectivity test — tries to fetch sysUpTime
     */
    async testConnectivity(target: SnmpTarget): Promise<boolean> {
        try {
            const result = await this.get(target, [SYSTEM_OIDS.sysUpTime]);
            return result.has(SYSTEM_OIDS.sysUpTime) && result.get(SYSTEM_OIDS.sysUpTime) !== null;
        } catch {
            return false;
        }
    }

    /**
     * Fetch standard MIB-II system information
     */
    async getSystemInfo(target: SnmpTarget): Promise<SystemInfo> {
        const oids = [
            SYSTEM_OIDS.sysDescr,
            SYSTEM_OIDS.sysObjectID,
            SYSTEM_OIDS.sysUpTime,
            SYSTEM_OIDS.sysContact,
            SYSTEM_OIDS.sysName,
            SYSTEM_OIDS.sysLocation,
        ];

        const result = await this.get(target, oids);

        return {
            sysDescr: result.get(SYSTEM_OIDS.sysDescr) || '',
            sysObjectID: result.get(SYSTEM_OIDS.sysObjectID) || '',
            sysUpTime: result.get(SYSTEM_OIDS.sysUpTime) || 0,
            sysName: result.get(SYSTEM_OIDS.sysName) || '',
            sysLocation: result.get(SYSTEM_OIDS.sysLocation) || '',
            sysContact: result.get(SYSTEM_OIDS.sysContact) || '',
        };
    }

    /**
 * Discover all interfaces on a device via ifTable + ifXTable walk
 */
    async getInterfaces(target: SnmpTarget): Promise<InterfaceInfo[]> {
        // Walk ifTable and ifXTable in parallel
        // Use independent try/catch so ifXTable failure doesn't kill discovery
        let ifTableData = new Map<string, any>();
        let ifXTableData = new Map<string, any>();

        try {
            ifTableData = await this.walk(target, '1.3.6.1.2.1.2.2');     // ifTable
        } catch (err) {
            this.logger.warn(`ifTable walk failed for ${target.host}: ${err}`);
        }

        try {
            ifXTableData = await this.walk(target, '1.3.6.1.2.1.31.1.1');   // ifXTable
        } catch (err) {
            this.logger.warn(`ifXTable walk failed for ${target.host}: ${err}`);
        }

        // Group by ifIndex
        const interfaces = new Map<number, Partial<InterfaceInfo>>();

        // Parse ifTable entries
        // IMPORTANT: append '.' to prevent prefix collisions
        // e.g., ifDescr (.2) must NOT match ifOutErrors (.20)
        for (const [oid, value] of ifTableData) {
            const ifIndex = this.extractIfIndex(oid);
            if (ifIndex === null) continue;

            if (!interfaces.has(ifIndex)) {
                interfaces.set(ifIndex, { ifIndex });
            }
            const iface = interfaces.get(ifIndex)!;

            if (oid.startsWith(IF_TABLE_OIDS.ifDescr + '.')) iface.ifDescr = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifType + '.')) iface.ifType = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifMtu + '.')) iface.ifMtu = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifSpeed + '.')) iface.ifSpeed = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifPhysAddress + '.')) iface.ifPhysAddress = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifAdminStatus + '.')) iface.ifAdminStatus = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifOperStatus + '.')) iface.ifOperStatus = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifInOctets + '.')) iface.ifInOctets = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifOutOctets + '.')) iface.ifOutOctets = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifInErrors + '.')) iface.ifInErrors = value;
            else if (oid.startsWith(IF_TABLE_OIDS.ifOutErrors + '.')) iface.ifOutErrors = value;
        }

        // Parse ifXTable entries (64-bit counters, ifName, ifAlias)
        for (const [oid, value] of ifXTableData) {
            const ifIndex = this.extractIfIndex(oid);
            if (ifIndex === null) continue;

            if (!interfaces.has(ifIndex)) {
                interfaces.set(ifIndex, { ifIndex });
            }
            const iface = interfaces.get(ifIndex)!;

            if (oid.startsWith(IF_XTABLE_OIDS.ifName + '.')) iface.ifName = value;
            else if (oid.startsWith(IF_XTABLE_OIDS.ifHighSpeed + '.')) iface.ifHighSpeed = value;
            else if (oid.startsWith(IF_XTABLE_OIDS.ifAlias + '.')) iface.ifAlias = value;
            // Prefer 64-bit counters when available
            else if (oid.startsWith(IF_XTABLE_OIDS.ifHCInOctets + '.')) iface.ifInOctets = value;
            else if (oid.startsWith(IF_XTABLE_OIDS.ifHCOutOctets + '.')) iface.ifOutOctets = value;
        }

        // If ifTable walk returned nothing, try a fallback: walk ifDescr to discover indices
        if (interfaces.size === 0) {
            this.logger.warn(`No interfaces found via ifTable walk for ${target.host}, trying ifDescr walk`);
            try {
                const ifDescrData = await this.walk(target, IF_TABLE_OIDS.ifDescr);
                for (const [oid, value] of ifDescrData) {
                    const ifIndex = this.extractIfIndex(oid);
                    if (ifIndex === null) continue;
                    interfaces.set(ifIndex, {
                        ifIndex,
                        ifDescr: value,
                        ifName: value,
                    });
                }
            } catch (err) {
                this.logger.warn(`ifDescr fallback walk also failed for ${target.host}: ${err}`);
            }
        }

        // Convert to array with defaults
        return Array.from(interfaces.values()).map((iface) => ({
            ifIndex: iface.ifIndex || 0,
            ifDescr: iface.ifDescr || '',
            ifName: iface.ifName || iface.ifDescr || '',
            ifAlias: iface.ifAlias || '',
            ifType: iface.ifType || 0,
            ifSpeed: iface.ifSpeed || 0,
            ifHighSpeed: iface.ifHighSpeed || 0,
            ifMtu: iface.ifMtu || 0,
            ifPhysAddress: iface.ifPhysAddress || '',
            ifAdminStatus: iface.ifAdminStatus || 0,
            ifOperStatus: iface.ifOperStatus || 0,
            ifInOctets: iface.ifInOctets || 0,
            ifOutOctets: iface.ifOutOctets || 0,
            ifInErrors: iface.ifInErrors || 0,
            ifOutErrors: iface.ifOutErrors || 0,
        }));
    }

    /**
     * Extract ifIndex from a full OID string.
     * e.g., "1.3.6.1.2.1.2.2.1.2.5" → 5
     */
    private extractIfIndex(oid: string): number | null {
        const parts = oid.split('.');
        const idx = parseInt(parts[parts.length - 1], 10);
        return isNaN(idx) ? null : idx;
    }

    /**
     * Parse varbind value based on ObjectType
     */
    private parseVarbindValue(vb: any): any {
        try {
            if (vb.type === snmp.ObjectType.OctetString) {
                // Try to interpret as UTF-8 string; fall back to hex for MACs
                const buf = vb.value;
                if (Buffer.isBuffer(buf)) {
                    // Check if it looks like a MAC address (6 bytes)
                    if (buf.length === 6) {
                        return Array.from(buf as Uint8Array)
                            .map((b) => b.toString(16).padStart(2, '0'))
                            .join(':');
                    }
                    return buf.toString('utf8').replace(/\0/g, '');
                }
                return String(vb.value);
            }

            if (vb.type === snmp.ObjectType.OID) {
                return String(vb.value);
            }

            if (vb.type === snmp.ObjectType.Counter64) {
                // net-snmp returns Counter64 as a Buffer — convert to number
                // MikroTik and some devices may return fewer than 8 bytes;
                // pad to 8 bytes to avoid ERR_BUFFER_OUT_OF_BOUNDS
                const buf = vb.value;
                if (Buffer.isBuffer(buf)) {
                    if (buf.length >= 8) {
                        return Number(buf.readBigUInt64BE(0));
                    }
                    // Pad smaller buffers to 8 bytes (left-pad with zeros)
                    const padded = Buffer.alloc(8, 0);
                    buf.copy(padded, 8 - buf.length);
                    return Number(padded.readBigUInt64BE(0));
                }
                return Number(vb.value) || 0;
            }

            return Number(vb.value) || vb.value;
        } catch (err) {
            this.logger.warn(`Failed to parse varbind (type=${vb.type}): ${err}`);
            return 0;
        }
    }
}
