import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface TokenPayload {
    sub: number;
    username: string;
    role: string;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly jwtSecret: string;
    private readonly jwtExpiresIn: string;
    private readonly jwtRefreshExpiresIn: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly auditService: AuditService,
    ) {
        this.jwtSecret = this.config.getOrThrow<string>('jwt.secret');
        this.jwtExpiresIn = this.config.get<string>('jwt.expiresIn', '15m');
        this.jwtRefreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn', '7d');
    }

    async register(username: string, email: string, password: string) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
        });

        if (existing) {
            throw new ConflictException(
                existing.username === username
                    ? 'Username already taken'
                    : 'Email already registered',
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await this.prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                role: 'admin', // First user is admin; later users default to 'viewer'
            },
            select: { id: true, username: true, email: true, role: true },
        });

        this.logger.log(`User registered: ${user.username}`);
        return user;
    }

    async login(username: string, password: string, ipAddress?: string) {
        const user = await this.prisma.user.findUnique({
            where: { username },
        });

        if (!user || !user.isActive) {
            // Log failed login
            await this.auditService.log({
                action: 'login_failed',
                entity: 'auth',
                details: { username, reason: !user ? 'User not found' : 'Account inactive' },
                ipAddress,
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            await this.auditService.log({
                userId: user.id,
                action: 'login_failed',
                entity: 'auth',
                details: { username, reason: 'Invalid password' },
                ipAddress,
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        const payload: TokenPayload = {
            sub: user.id,
            username: user.username,
            role: user.role,
        };

        const accessToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn as any,
        });

        const refreshToken = jwt.sign(
            { sub: user.id, type: 'refresh' },
            this.jwtSecret,
            { expiresIn: this.jwtRefreshExpiresIn as any },
        );

        // Log successful login
        await this.auditService.log({
            userId: user.id,
            action: 'login_success',
            entity: 'auth',
            details: { username },
            ipAddress,
        });

        this.logger.log(`User logged in: ${user.username}`);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        };
    }

    async refreshToken(token: string) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as any;

            if (decoded.type !== 'refresh') {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const user = await this.prisma.user.findUnique({
                where: { id: decoded.sub },
            });

            if (!user || !user.isActive) {
                throw new UnauthorizedException('User not found or inactive');
            }

            const payload: TokenPayload = {
                sub: user.id,
                username: user.username,
                role: user.role,
            };

            const accessToken = jwt.sign(payload, this.jwtSecret, {
                expiresIn: this.jwtExpiresIn as any,
            });

            return { accessToken };
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async getProfile(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return user;
    }

    /**
     * List all users (admin only).
     */
    async listUsers() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                displayName: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Update a user's profile (admin only).
     */
    async updateUser(id: number, data: { email?: string; displayName?: string; role?: string; isActive?: boolean }) {
        const updateData: any = {};
        if (data.email !== undefined) updateData.email = data.email;
        if (data.displayName !== undefined) updateData.displayName = data.displayName;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        return this.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                isActive: true,
                displayName: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
    }

    /**
     * Deactivate a user (soft delete).
     */
    async deactivateUser(id: number) {
        return this.prisma.user.update({
            where: { id },
            data: { isActive: false },
            select: { id: true, username: true, isActive: true },
        });
    }
}

