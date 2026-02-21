import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { setupTestContainers, teardownTestContainers } from './setup';

describe('Devices API', () => {
    let app: INestApplication;
    let authToken: string;

    beforeAll(async () => {
        await setupTestContainers();

        const module: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = module.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();

        // Login as admin
        const loginRes = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        authToken = loginRes.body.accessToken;
    }, 120000);

    afterAll(async () => {
        await app?.close();
        await teardownTestContainers();
    });

    describe('GET /api/v1/devices', () => {
        it('returns paginated device list', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/devices?page=1&limit=10')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('items');
            expect(res.body).toHaveProperty('total');
        });

        it('filters by status', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/devices?status=up')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            if (res.body.items?.length) {
                res.body.items.forEach((d: any) => {
                    expect(d.status).toBe('up');
                });
            }
        });

        it('rejects unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/devices')
                .expect(401);
        });
    });

    describe('POST /api/v1/devices', () => {
        it('creates a new device', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    hostname: 'test-router-integration',
                    ipAddress: '192.168.99.1',
                    deviceType: 'router',
                })
                .expect(201);

            expect(res.body.hostname).toBe('test-router-integration');
            expect(res.body.id).toBeDefined();
        });

        it('rejects invalid payload', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ hostname: '' }) // missing required fields
                .expect(400);
        });
    });

    describe('RBAC enforcement', () => {
        let viewerToken: string;

        beforeAll(async () => {
            // Register a viewer user
            await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({ username: 'test-viewer', email: 'viewer@test.com', password: 'viewer123' });

            const loginRes = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ username: 'test-viewer', password: 'viewer123' });
            viewerToken = loginRes.body.accessToken;
        });

        it('viewer can read devices', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/devices')
                .set('Authorization', `Bearer ${viewerToken}`)
                .expect(200);
        });

        it('viewer cannot create devices', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/devices')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({ hostname: 'blocked', ipAddress: '10.0.0.1', deviceType: 'router' })
                .expect(403);
        });

        it('viewer cannot delete devices', async () => {
            await request(app.getHttpServer())
                .delete('/api/v1/devices/1')
                .set('Authorization', `Bearer ${viewerToken}`)
                .expect(403);
        });
    });
});
