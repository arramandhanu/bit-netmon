import { Injectable, Logger } from '@nestjs/common';
import {
    CISCO_SYS_OBJECT_PREFIXES,
    MIKROTIK_SYS_OBJECT_PREFIX,
} from '@netmon/shared';

export interface ClassificationResult {
    deviceType: 'router' | 'switch' | 'access_point' | 'firewall' | 'server' | 'unknown';
    vendor: string;
    model: string;
}

/**
 * Classifies network devices based on sysObjectID and sysDescr.
 *
 * Classification priority:
 *   1. Known enterprise OID prefix → vendor + device type
 *   2. sysDescr keyword heuristics → device type guess
 *   3. Falls back to 'unknown'
 */
@Injectable()
export class DeviceClassifierService {
    private readonly logger = new Logger(DeviceClassifierService.name);

    classify(sysObjectID: string, sysDescr: string): ClassificationResult {
        // ─── Cisco ──────────────────────────────────────
        for (const prefix of CISCO_SYS_OBJECT_PREFIXES) {
            if (sysObjectID.startsWith(prefix)) {
                return {
                    vendor: 'Cisco',
                    model: this.extractModelFromDescr(sysDescr),
                    deviceType: this.classifyCiscoByDescr(sysDescr),
                };
            }
        }

        // ─── MikroTik ───────────────────────────────────
        if (sysObjectID.startsWith(MIKROTIK_SYS_OBJECT_PREFIX)) {
            return {
                vendor: 'MikroTik',
                model: this.extractMikroTikModel(sysDescr),
                deviceType: 'router', // MikroTik devices are primarily routers
            };
        }

        // ─── Ubiquiti ───────────────────────────────────
        if (sysObjectID.startsWith('1.3.6.1.4.1.41112')) {
            return {
                vendor: 'Ubiquiti',
                model: this.extractModelFromDescr(sysDescr),
                deviceType: this.classifyUbiquitiByDescr(sysDescr),
            };
        }

        // ─── Juniper ────────────────────────────────────
        if (sysObjectID.startsWith('1.3.6.1.4.1.2636')) {
            return {
                vendor: 'Juniper',
                model: this.extractModelFromDescr(sysDescr),
                deviceType: this.classifyJuniperByDescr(sysDescr),
            };
        }

        // ─── HP / Aruba ─────────────────────────────────
        if (sysObjectID.startsWith('1.3.6.1.4.1.11.') ||
            sysObjectID.startsWith('1.3.6.1.4.1.47196.')) {
            return {
                vendor: 'HPE/Aruba',
                model: this.extractModelFromDescr(sysDescr),
                deviceType: this.classifyHPByDescr(sysDescr),
            };
        }

        // ─── Fortinet ───────────────────────────────────
        if (sysObjectID.startsWith('1.3.6.1.4.1.12356')) {
            return {
                vendor: 'Fortinet',
                model: this.extractModelFromDescr(sysDescr),
                deviceType: 'firewall',
            };
        }

        // ─── Generic heuristics from sysDescr ───────────
        return this.classifyByDescription(sysDescr);
    }

    private classifyCiscoByDescr(descr: string): ClassificationResult['deviceType'] {
        const lower = descr.toLowerCase();
        if (lower.includes('adaptive security') || lower.includes('asa')) return 'firewall';
        if (lower.includes('wireless') || lower.includes('air-') || lower.includes('aironet')) return 'access_point';
        if (lower.includes('catalyst') || lower.includes('switch') || lower.includes('c2960') || lower.includes('c3750')) return 'switch';
        return 'router';
    }

    private classifyUbiquitiByDescr(descr: string): ClassificationResult['deviceType'] {
        const lower = descr.toLowerCase();
        if (lower.includes('uap') || lower.includes('unifi ap') || lower.includes('u6')) return 'access_point';
        if (lower.includes('usw') || lower.includes('switch')) return 'switch';
        return 'router';
    }

    private classifyJuniperByDescr(descr: string): ClassificationResult['deviceType'] {
        const lower = descr.toLowerCase();
        if (lower.includes('srx') || lower.includes('firewall')) return 'firewall';
        if (lower.includes('ex') || lower.includes('switch')) return 'switch';
        return 'router';
    }

    private classifyHPByDescr(descr: string): ClassificationResult['deviceType'] {
        const lower = descr.toLowerCase();
        if (lower.includes('aruba') && (lower.includes('ap') || lower.includes('instant'))) return 'access_point';
        if (lower.includes('switch') || lower.includes('procurve')) return 'switch';
        return 'switch'; // HP is mostly switches
    }

    private classifyByDescription(descr: string): ClassificationResult {
        const lower = descr.toLowerCase();

        if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('centos') || lower.includes('debian')) {
            return { vendor: 'Linux', model: this.extractModelFromDescr(descr), deviceType: 'server' };
        }
        if (lower.includes('windows')) {
            return { vendor: 'Microsoft', model: 'Windows Server', deviceType: 'server' };
        }
        if (lower.includes('freebsd') || lower.includes('openbsd')) {
            return { vendor: 'BSD', model: this.extractModelFromDescr(descr), deviceType: 'server' };
        }
        if (lower.includes('pfsense')) {
            return { vendor: 'pfSense', model: 'pfSense', deviceType: 'firewall' };
        }
        if (lower.includes('openwrt')) {
            return { vendor: 'OpenWrt', model: 'OpenWrt', deviceType: 'router' };
        }

        this.logger.debug(`Could not classify device: sysDescr="${descr}"`);
        return { vendor: 'Unknown', model: descr.substring(0, 100), deviceType: 'unknown' };
    }

    private extractModelFromDescr(descr: string): string {
        // Take first line / first 100 chars as model identifier
        const firstLine = descr.split('\n')[0].trim();
        return firstLine.substring(0, 100);
    }

    private extractMikroTikModel(descr: string): string {
        // MikroTik sysDescr is typically "RouterOS <model>"
        const match = descr.match(/RouterOS\s+(.+)/i);
        return match ? match[1].trim() : descr.substring(0, 100);
    }
}
