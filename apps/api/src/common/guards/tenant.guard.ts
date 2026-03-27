import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User object shape as returned by JwtStrategy.validate().
 */
export interface TenantUser {
    id: number;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    tenantId: number | null;
}

/**
 * Returns true when the user is the global superadmin (built-in admin without a tenant).
 * Superadmins bypass all tenant-scoping.
 */
export function isSuperAdmin(user: TenantUser): boolean {
    return user.role === 'admin' && user.tenantId == null;
}

/**
 * Builds and returns a Prisma `where` clause scoped to the user's tenant.
 * - Superadmin → empty object (no filtering)
 * - Tenant user → { tenantId: user.tenantId }
 */
export function tenantWhere(user: TenantUser): { tenantId?: number | null } {
    if (isSuperAdmin(user)) return {};
    return { tenantId: user.tenantId };
}

/**
 * @CurrentUser() decorator — extracts the authenticated user from the request.
 * Usage: @CurrentUser() user: TenantUser
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): TenantUser => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
