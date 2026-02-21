import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;

export async function setupTestContainers() {
    // Start PostgreSQL with TimescaleDB
    pgContainer = await new PostgreSqlContainer('timescale/timescaledb:2.14.2-pg16')
        .withDatabase('netmon_test')
        .withUsername('test')
        .withPassword('test')
        .withExposedPorts(5432)
        .start();

    // Start Redis
    redisContainer = await new GenericContainer('redis:7.2-alpine')
        .withExposedPorts(6379)
        .start();

    // Set env vars for Prisma
    const dbUrl = pgContainer.getConnectionUri();
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = String(redisContainer.getMappedPort(6379));
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';

    // Run migrations
    execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: dbUrl },
        cwd: process.cwd(),
        stdio: 'pipe',
    });
}

export async function teardownTestContainers() {
    await pgContainer?.stop();
    await redisContainer?.stop();
}
