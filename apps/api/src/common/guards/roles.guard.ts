import {
    Injectable,
    CanActivate,
    ExecutionContext,
    SetMetadata,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Supported roles (matches Prisma UserRole enum).
 */
export type AppRole = 'admin' | 'operator' | 'viewer' | 'user';

/**
 * Permission matrix — what each role can do.
 */
const PERMISSIONS: Record<AppRole, Set<string>> = {
    admin: new Set([
        'devices:read', 'devices:write', 'devices:delete',
        'alerts:read', 'alerts:write', 'alerts:acknowledge',
        'tickets:read', 'tickets:write', 'tickets:delete',
        'users:read', 'users:write', 'users:delete',
        'discovery:run',
        'reports:generate',
        'settings:read', 'settings:write',
        'audit:read',
    ]),
    operator: new Set([
        'devices:read', 'devices:write',
        'alerts:read', 'alerts:write', 'alerts:acknowledge',
        'tickets:read', 'tickets:write',
        'discovery:run',
        'reports:generate',
        'settings:read',
        'audit:read',
    ]),
    viewer: new Set([
        'devices:read',
        'alerts:read',
        'tickets:read',
        'reports:generate',
        'settings:read',
        'audit:read',
    ]),
    user: new Set([
        'devices:read',
        'alerts:read',
        'tickets:read',
        'tickets:write',
        'reports:generate',
    ]),
};

/* ─── Decorators ─────────────────────────────────────────── */

export const ROLES_KEY = 'roles';
export const PERMISSION_KEY = 'permission';

/**
 * Restrict a route to specific roles.
 * Usage: @Roles('admin', 'operator')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Restrict a route by a specific permission string.
 * Usage: @RequirePermission('devices:delete')
 */
export const RequirePermission = (permission: string) =>
    SetMetadata(PERMISSION_KEY, permission);

/* ─── Guard ──────────────────────────────────────────────── */

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<AppRole[] | undefined>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        const requiredPermission = this.reflector.get<string | undefined>(
            PERMISSION_KEY,
            context.getHandler(),
        );

        // No role/permission requirement → allow
        if (!requiredRoles?.length && !requiredPermission) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.role) {
            throw new ForbiddenException('Access denied');
        }

        const userRole = user.role as AppRole;

        // Role-based check
        if (requiredRoles?.length) {
            if (!requiredRoles.includes(userRole)) {
                throw new ForbiddenException(
                    `Role '${userRole}' is not authorized. Required: ${requiredRoles.join(', ')}`,
                );
            }
        }

        // Permission-based check
        if (requiredPermission) {
            const perms = PERMISSIONS[userRole];
            if (!perms?.has(requiredPermission)) {
                throw new ForbiddenException(
                    `Role '${userRole}' lacks permission '${requiredPermission}'`,
                );
            }
        }

        return true;
    }
}
