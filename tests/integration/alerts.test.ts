import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { setupTestContainers, teardownTestContainers } from './setup';

describe('Alerts API', () => {
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

    describe('Alert Rules CRUD', () => {
        let ruleId: number;

        it('creates a new alert rule', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/alerts/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'High CPU Test',
                    metric: 'cpu_usage',
                    operator: 'gt',
                    threshold: 90,
                    severity: 'critical',
                    duration: 300,
                })
                .expect(201);

            expect(res.body.name).toBe('High CPU Test');
            ruleId = res.body.id;
        });

        it('lists all alert rules', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/alerts/rules')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('gets a single rule', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/v1/alerts/rules/${ruleId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.id).toBe(ruleId);
        });

        it('updates a rule', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/api/v1/alerts/rules/${ruleId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ threshold: 95 })
                .expect(200);

            expect(res.body.threshold).toBe(95);
        });

        it('deletes a rule (admin only)', async () => {
            await request(app.getHttpServer())
                .delete(`/api/v1/alerts/rules/${ruleId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        });
    });

    describe('Alert History & Stats', () => {
        it('returns alert history', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/alerts/history')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('items');
        });

        it('returns active alerts', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/alerts/active')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });

        it('returns alert stats', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/alerts/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total');
        });
    });
});
