import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { PinoLoggerService } from './common/logger/pino-logger.service';

// ─── BigInt JSON serialization ──────────────────
// Prisma returns BigInt for fields like uptime, ifSpeed.
// Express's JSON.stringify() cannot handle BigInt natively.
(BigInt.prototype as any).toJSON = function () {
    return Number(this);
};

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    // ─── Structured Logging (Pino) ──────────────────
    const pinoLogger = app.get(PinoLoggerService);
    app.useLogger(pinoLogger);

    const config = app.get(ConfigService);
    const port = config.get<number>('port', 3000);
    const nodeEnv = config.get<string>('nodeEnv', 'development');
    const logger = new Logger('Bootstrap');

    // ─── Security ───────────────────────────────────
    app.use(helmet());

    // ─── Global Exception Filter ────────────────────
    app.useGlobalFilters(new GlobalExceptionFilter());

    // ─── API Versioning ─────────────────────────────
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // ─── Validation ─────────────────────────────────
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // ─── CORS ───────────────────────────────────────
    app.enableCors({
        origin: nodeEnv === 'production'
            ? ['https://netmon.yourdomain.com']
            : ['http://localhost:3001', 'http://localhost:3000'],
        credentials: true,
    });

    // ─── Swagger (development only) ─────────────────
    if (nodeEnv !== 'production') {
        const swaggerConfig = new DocumentBuilder()
            .setTitle('NetMon API')
            .setDescription('Network Monitoring System — REST API')
            .setVersion('1.0')
            .addBearerAuth()
            .addTag('System', 'Health checks and system status')
            .addTag('Devices', 'Device CRUD and management')
            .addTag('Discovery', 'SNMP network discovery')
            .addTag('Metrics', 'Time-series metrics queries')
            .addTag('Alerts', 'Alert rules and history')
            .addTag('Auth', 'Authentication and authorization')
            .build();

        const document = SwaggerModule.createDocument(app, swaggerConfig);
        SwaggerModule.setup('api/docs', app, document, {
            swaggerOptions: {
                persistAuthorization: true,
                tagsSorter: 'alpha',
                operationsSorter: 'alpha',
            },
        });

        logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
    }

    // ─── Graceful Shutdown ──────────────────────────
    app.enableShutdownHooks();

    await app.listen(port);
    logger.log(`NetMon API running on http://localhost:${port} [${nodeEnv}]`);
}

bootstrap();
