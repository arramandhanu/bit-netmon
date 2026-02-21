import { z } from 'zod';

/**
 * Environment schema — validated at application startup.
 *
 * If any required variable is missing or malformed, the app
 * will fail fast with a descriptive error message instead of
 * crashing at runtime with a cryptic undefined.
 */
const envSchema = z.object({
    // App
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().int().default(3000),

    // Database
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().default(''),

    // Authentication
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Encryption
    ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 characters'),

    // SNMP defaults
    SNMP_DEFAULT_TIMEOUT: z.coerce.number().int().default(5000),
    SNMP_DEFAULT_RETRIES: z.coerce.number().int().default(1),
    SNMP_POLLING_INTERVAL: z.coerce.number().int().default(300),

    // Logging
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Notifications (optional)
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate raw process.env and return typed config.
 * Called by NestJS ConfigModule at startup.
 */
export function validateEnv(raw: Record<string, unknown>): EnvConfig {
    const result = envSchema.safeParse(raw);

    if (!result.success) {
        const formatted = result.error.issues
            .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        throw new Error(`\n❌ Environment validation failed:\n${formatted}\n`);
    }

    return result.data;
}

/**
 * NestJS configuration factory.
 *
 * Usage in services:
 *   this.config.get('database.url')
 *   this.config.get('snmp.defaultTimeout')
 */
export default () => {
    const env = validateEnv(process.env);

    return {
        nodeEnv: env.NODE_ENV,
        port: env.API_PORT,

        database: {
            url: env.DATABASE_URL,
        },

        redis: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD || undefined,
        },

        jwt: {
            secret: env.JWT_SECRET,
            expiresIn: env.JWT_EXPIRES_IN,
            refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
        },

        encryptionKey: env.ENCRYPTION_KEY,

        snmp: {
            defaultTimeout: env.SNMP_DEFAULT_TIMEOUT,
            defaultRetries: env.SNMP_DEFAULT_RETRIES,
            pollingInterval: env.SNMP_POLLING_INTERVAL,
        },

        logging: {
            level: env.LOG_LEVEL,
        },

        telegram: {
            botToken: env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_CHAT_ID,
        },

        smtp: {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    };
};
