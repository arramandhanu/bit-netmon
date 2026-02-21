declare module 'net-snmp' {
    export const Version1: number;
    export const Version2c: number;
    export const SecurityLevel: {
        noAuthNoPriv: number;
        authNoPriv: number;
        authPriv: number;
    };
    export const AuthProtocols: {
        md5: number;
        sha: number;
        sha256?: number;
    };
    export const PrivProtocols: {
        des: number;
        aes: number;
        aes256b?: number;
    };
    export const ObjectType: {
        OctetString: number;
        OID: number;
        Counter64: number;
    };

    export interface Session {
        get(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void;
        subtree(
            oid: string,
            feedCallback: (varbinds: any[]) => void,
            doneCallback: (error: Error | null) => void,
        ): void;
        close(): void;
    }

    export function createSession(host: string, community: string, options?: any): Session;
    export function createV3Session(host: string, user: any, options?: any): Session;
    export function isVarbindError(varbind: any): boolean;
}
