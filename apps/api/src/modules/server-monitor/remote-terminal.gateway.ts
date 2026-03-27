import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Client as SSHClient } from 'ssh2';

@WebSocketGateway({
    namespace: '/terminal',
    cors: { origin: '*' },
})
export class RemoteTerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server!: Server;
    private readonly logger = new Logger(RemoteTerminalGateway.name);
    private sessions = new Map<string, SSHClient>();

    handleConnection(client: Socket) {
        this.logger.log(`Terminal client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Terminal client disconnected: ${client.id}`);
        const ssh = this.sessions.get(client.id);
        if (ssh) {
            ssh.end();
            this.sessions.delete(client.id);
        }
    }

    @SubscribeMessage('ssh:connect')
    handleSSHConnect(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { host: string; port?: number; username: string; password: string },
    ) {
        const ssh = new SSHClient();
        this.sessions.set(client.id, ssh);

        ssh.on('ready', () => {
            client.emit('ssh:status', { connected: true });
            ssh.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
                if (err) {
                    client.emit('ssh:error', { message: err.message });
                    return;
                }

                stream.on('data', (chunk: Buffer) => {
                    client.emit('ssh:data', chunk.toString('utf-8'));
                });

                stream.on('close', () => {
                    client.emit('ssh:status', { connected: false });
                    ssh.end();
                    this.sessions.delete(client.id);
                });

                // Listen for terminal input from client
                client.on('ssh:input', (input: string) => {
                    stream.write(input);
                });

                // Handle resize
                client.on('ssh:resize', ({ cols, rows }: { cols: number; rows: number }) => {
                    stream.setWindow(rows, cols, 0, 0);
                });
            });
        });

        ssh.on('error', (err) => {
            this.logger.error(`SSH error for ${client.id}: ${err.message}`);
            client.emit('ssh:error', { message: err.message });
            this.sessions.delete(client.id);
        });

        ssh.connect({
            host: data.host,
            port: data.port || 22,
            username: data.username,
            password: data.password,
            readyTimeout: 10000,
        });
    }

    @SubscribeMessage('ssh:disconnect')
    handleSSHDisconnect(@ConnectedSocket() client: Socket) {
        const ssh = this.sessions.get(client.id);
        if (ssh) {
            ssh.end();
            this.sessions.delete(client.id);
        }
        client.emit('ssh:status', { connected: false });
    }
}
