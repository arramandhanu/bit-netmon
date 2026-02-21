"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERFACE_STATUSES = exports.USER_ROLES = exports.ALERT_STATES = exports.ALERT_SEVERITIES = exports.SNMP_PRIV_PROTOCOLS = exports.SNMP_AUTH_PROTOCOLS = exports.SNMP_VERSIONS = exports.DEVICE_STATUSES = exports.DEVICE_TYPES = void 0;
exports.DEVICE_TYPES = ['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'];
exports.DEVICE_STATUSES = ['up', 'down', 'warning', 'maintenance', 'unknown'];
exports.SNMP_VERSIONS = ['v1', 'v2c', 'v3'];
exports.SNMP_AUTH_PROTOCOLS = ['MD5', 'SHA', 'SHA256'];
exports.SNMP_PRIV_PROTOCOLS = ['DES', 'AES', 'AES256'];
exports.ALERT_SEVERITIES = ['info', 'warning', 'critical'];
exports.ALERT_STATES = ['triggered', 'acknowledged', 'resolved'];
exports.USER_ROLES = ['admin', 'operator', 'viewer'];
exports.INTERFACE_STATUSES = ['up', 'down', 'testing', 'unknown'];
//# sourceMappingURL=index.js.map