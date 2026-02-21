import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { Logger } from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
    private readonly logger: Logger;

    constructor(config: ConfigService) {
        const nodeEnv = config.get<string>('nodeEnv', 'development');
        const logLevel = config.get<string>('logging.level', 'info');

        this.logger = pino({
            level: logLevel,
            transport:
                nodeEnv !== 'production'
                    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } }
                    : undefined,
            base: {
                service: 'netmon-api',
                env: nodeEnv,
            },
            timestamp: pino.stdTimeFunctions.isoTime,
        });
    }

    log(message: string, context?: string) {
        this.logger.info({ context }, message);
    }

    error(message: string, trace?: string, context?: string) {
        this.logger.error({ context, trace }, message);
    }

    warn(message: string, context?: string) {
        this.logger.warn({ context }, message);
    }

    debug(message: string, context?: string) {
        this.logger.debug({ context }, message);
    }

    verbose(message: string, context?: string) {
        this.logger.trace({ context }, message);
    }

    fatal(message: string, context?: string) {
        this.logger.fatal({ context }, message);
    }
}
