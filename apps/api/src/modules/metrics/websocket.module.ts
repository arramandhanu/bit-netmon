import { Global, Module } from '@nestjs/common';
import { MetricsGateway } from './metrics.gateway';

/**
 * Standalone WebSocket module — extracted to avoid circular dependency
 * between MetricsModule (imports PollingModule) and PollingModule
 * (needs MetricsGateway).
 *
 * @Global() so any module can inject MetricsGateway without importing.
 */
@Global()
@Module({
    providers: [MetricsGateway],
    exports: [MetricsGateway],
})
export class WebSocketModule { }
