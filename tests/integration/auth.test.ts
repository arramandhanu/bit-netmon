import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { setupTestContainers, teardownTestContainers } from './setup';

describe('Auth API', () => {
    let app: INestApplication;

    beforeAll(async () => {
        await setupTestContainers();

        const module: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = module.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    }, 120000);

    afterAll(async () => {
        await app?.close();
        await teardownTestContainers();
    });

    describe('POST /api/v1/auth/register', () => {
        it('registers a new user', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    username: 'auth-test-user',
                    email: 'authtest@example.com',
                    password: 'securePass123',
                })
                .expect(201);

            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
        });

        it('rejects duplicate username', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    username: 'auth-test-user',
                    email: 'another@example.com',
                    password: 'securePass123',
                })
                .expect(409);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('returns access and refresh tokens on valid credentials', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ username: 'auth-test-user', password: 'securePass123' })
                .expect(200);

            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
            expect(res.body.user).toBeDefined();
            expect(res.body.user.username).toBe('auth-test-user');
        });

        it('rejects invalid password', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ username: 'auth-test-user', password: 'wrongPassword' })
                .expect(401);
        });

        it('rejects nonexistent user', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ username: 'ghost', password: 'anything' })
                .expect(401);
        });
    });

    describe('GET /api/v1/auth/me', () => {
        let token: string;

        beforeAll(async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ username: 'auth-test-user', password: 'securePass123' });
            token = res.body.accessToken;
        });

        it('returns current user profile', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.username).toBe('auth-test-user');
            expect(res.body).not.toHaveProperty('passwordHash');
        });

        it('rejects invalid token', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/auth/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        let refreshToken: string;

        beforeAll(async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ username: 'auth-test-user', password: 'securePass123' });
            refreshToken = res.body.refreshToken;
        });

        it('returns new tokens with valid refresh token', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            expect(res.body.accessToken).toBeDefined();
        });
    });
});
