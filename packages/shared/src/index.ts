// ─── Constants ──────────────────────────────────────
export {
    SYSTEM_OIDS,
    IF_TABLE_OIDS,
    IF_XTABLE_OIDS,
    HOST_RESOURCES_OIDS,
    LLDP_OIDS,
} from './constants/oids';

export { CISCO_OIDS, CISCO_SYS_OBJECT_PREFIXES } from './constants/oids-cisco';
export { MIKROTIK_OIDS, MIKROTIK_SYS_OBJECT_PREFIX } from './constants/oids-mikrotik';

// ─── Types ──────────────────────────────────────────
export type {
    DeviceType,
    DeviceStatus,
    SnmpVersion,
    SnmpAuthProtocol,
    SnmpPrivProtocol,
    AlertSeverity,
    AlertState,
    UserRole,
    InterfaceStatus,
    PaginatedResponse,
    ApiError,
} from './types';

export {
    DEVICE_TYPES,
    DEVICE_STATUSES,
    SNMP_VERSIONS,
    SNMP_AUTH_PROTOCOLS,
    SNMP_PRIV_PROTOCOLS,
    ALERT_SEVERITIES,
    ALERT_STATES,
    USER_ROLES,
    INTERFACE_STATUSES,
} from './types';

// ─── Validation Schemas ─────────────────────────────
export {
    createDeviceSchema,
    updateDeviceSchema,
    createAlertRuleSchema,
    discoverSubnetSchema,
} from './schemas';

export type {
    CreateDeviceInput,
    UpdateDeviceInput,
    CreateAlertRuleInput,
    DiscoverSubnetInput,
} from './schemas';
