import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    namespace: '/metrics',
    cors: {
        origin: '*',
        credentials: true,
    },
})
export class MetricsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(MetricsGateway.name);

    @WebSocketServer()
    server!: Server;

    afterInit() {
        this.logger.log('Metrics WebSocket gateway initialized');
    }

    handleConnection(client: Socket) {
        this.logger.debug(`Client connected: ${client.id}`);
        // Auto-join the dashboard room
        client.join('dashboard');
    }

    handleDisconnect(client: Socket) {
        this.logger.debug(`Client disconnected: ${client.id}`);
    }

    /**
     * Allow clients to subscribe to a specific device's updates.
     * Usage from client: socket.emit('subscribeDevice', { deviceId: 42 })
     */
    @SubscribeMessage('subscribeDevice')
    handleSubscribeDevice(client: Socket, payload: { deviceId: number }) {
        const room = `device:${payload.deviceId}`;
        client.join(room);
        this.logger.debug(`Client ${client.id} subscribed to ${room}`);
        return { event: 'subscribed', data: { room } };
    }

    /**
     * Allow clients to unsubscribe from a device.
     */
    @SubscribeMessage('unsubscribeDevice')
    handleUnsubscribeDevice(client: Socket, payload: { deviceId: number }) {
        const room = `device:${payload.deviceId}`;
        client.leave(room);
        return { event: 'unsubscribed', data: { room } };
    }

    // ─── Broadcast methods (called from PollingProcessor) ─────

    /**
     * Broadcast device metrics update to dashboard + device room.
     */
    broadcastDeviceUpdate(deviceId: number, data: {
        status: string;
        cpu?: number | null;
        memoryPercent?: number | null;
        responseTime: number;
        interfacesPolled: number;
    }) {
        const payload = { deviceId, ...data, timestamp: new Date().toISOString() };
        this.server.to('dashboard').emit('deviceUpdate', payload);
        this.server.to(`device:${deviceId}`).emit('deviceUpdate', payload);
    }

    /**
     * Broadcast when a device goes down.
     */
    broadcastDeviceDown(deviceId: number, responseTime: number) {
        const payload = {
            deviceId,
            status: 'down',
            responseTime,
            timestamp: new Date().toISOString(),
        };
        this.server.to('dashboard').emit('deviceDown', payload);
        this.server.to(`device:${deviceId}`).emit('deviceDown', payload);
    }

    /**
     * Broadcast alert triggered/resolved events.
     */
    broadcastAlert(alert: {
        id: number;
        ruleName: string;
        severity: string;
        deviceId: number;
        state: string;
        message: string;
    }) {
        this.server.to('dashboard').emit('alert', {
            ...alert,
            timestamp: new Date().toISOString(),
        });
    }
}
