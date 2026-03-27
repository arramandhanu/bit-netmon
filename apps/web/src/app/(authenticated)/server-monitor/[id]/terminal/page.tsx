'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Terminal as TermIcon, Loader2, Wifi, WifiOff, Lock, Server } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

export default function TerminalPage() {
    const params = useParams();
    const serverId = params.id as string;
    const router = useRouter();

    const termRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<any>(null);
    const terminalRef = useRef<any>(null);

    const [serverInfo, setServerInfo] = useState<any>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auth form
    const [host, setHost] = useState('');
    const [port, setPort] = useState('22');
    const [username, setUsername] = useState('root');
    const [password, setPassword] = useState('');

    // Fetch server info
    useEffect(() => {
        api.get(`/server-monitors/${serverId}`)
            .then(({ data }) => {
                setServerInfo(data);
                if (data.ip_address) setHost(data.ip_address);
            })
            .catch(() => setError('Server not found'));
    }, [serverId]);

    const connect = useCallback(async () => {
        setConnecting(true);
        setError(null);

        try {
            // Dynamic import xterm and socket.io
            const [{ Terminal }, { FitAddon }, ioModule] = await Promise.all([
                import('@xterm/xterm'),
                import('@xterm/addon-fit'),
                import('socket.io-client'),
            ]);

            // Import xterm CSS
            await import('@xterm/xterm/css/xterm.css' as any);

            // Create terminal
            const fitAddon = new FitAddon();
            const term = new Terminal({
                cursorBlink: true,
                fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                fontSize: 14,
                theme: {
                    background: '#1a1b26',
                    foreground: '#c0caf5',
                    cursor: '#c0caf5',
                    selectionBackground: '#33467c',
                    black: '#15161e',
                    red: '#f7768e',
                    green: '#9ece6a',
                    yellow: '#e0af68',
                    blue: '#7aa2f7',
                    magenta: '#bb9af7',
                    cyan: '#7dcfff',
                    white: '#a9b1d6',
                },
            });

            term.loadAddon(fitAddon);

            if (termRef.current) {
                termRef.current.innerHTML = '';
                term.open(termRef.current);
                fitAddon.fit();
            }

            terminalRef.current = term;

            // Connect via socket.io
            const wsUrl = window.location.origin.replace(':3000', ':3001') + '/terminal';
            const socket = ioModule.io(wsUrl, {
                transports: ['websocket'],
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                socket.emit('ssh:connect', {
                    host,
                    port: parseInt(port),
                    username,
                    password,
                });
            });

            socket.on('ssh:status', (data: { connected: boolean }) => {
                setConnected(data.connected);
                setConnecting(false);
                if (!data.connected) {
                    term.write('\r\n\x1b[33m--- Connection closed ---\x1b[0m\r\n');
                }
            });

            socket.on('ssh:data', (data: string) => {
                term.write(data);
            });

            socket.on('ssh:error', (data: { message: string }) => {
                setError(data.message);
                setConnecting(false);
                term.write(`\r\n\x1b[31m${data.message}\x1b[0m\r\n`);
            });

            // Send terminal input to SSH
            term.onData((data: string) => {
                socket.emit('ssh:input', data);
            });

            // Handle resize
            const ro = new ResizeObserver(() => {
                fitAddon.fit();
                socket.emit('ssh:resize', { cols: term.cols, rows: term.rows });
            });
            if (termRef.current) ro.observe(termRef.current);

        } catch (err: any) {
            setError(err.message);
            setConnecting(false);
        }
    }, [host, port, username, password]);

    const disconnect = () => {
        socketRef.current?.emit('ssh:disconnect');
        socketRef.current?.disconnect();
        setConnected(false);
    };

    // Cleanup
    useEffect(() => {
        return () => {
            socketRef.current?.disconnect();
            terminalRef.current?.dispose();
        };
    }, []);

    return (
        <div className="space-y-4 h-[calc(100vh-5rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href={`/server-monitor/${serverId}`}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg">
                        <TermIcon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            Terminal
                            {serverInfo && <span className="text-gray-400 font-normal text-sm">— {serverInfo.name}</span>}
                        </h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            {connected ? (
                                <><Wifi className="h-3 w-3 text-emerald-500" /><span className="text-emerald-600">Connected to {host}</span></>
                            ) : (
                                <><WifiOff className="h-3 w-3 text-gray-400" /><span>Not connected</span></>
                            )}
                        </p>
                    </div>
                </div>
                {connected && (
                    <button onClick={disconnect}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                        Disconnect
                    </button>
                )}
            </div>

            {/* Connection form (shown when not connected) */}
            {!connected && !connecting && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-semibold">SSH Connection</h3>
                    </div>
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1 space-y-1">
                            <label className="text-xs font-medium text-gray-600">Host</label>
                            <input value={host} onChange={e => setHost(e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="192.168.1.1" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Port</label>
                            <input value={port} onChange={e => setPort(e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="22" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Username</label>
                            <input value={username} onChange={e => setUsername(e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="root" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Password</label>
                            <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <button onClick={connect} disabled={!host || !username || !password}
                        className="mt-4 w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
                        <TermIcon className="h-4 w-4" /> Connect
                    </button>
                </div>
            )}

            {/* Connecting state */}
            {connecting && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-blue-700">Connecting to {host}...</span>
                </div>
            )}

            {/* Terminal */}
            <div
                ref={termRef}
                className="flex-1 rounded-xl overflow-hidden bg-[#1a1b26] border border-gray-700"
                style={{ minHeight: connected ? '400px' : '0', display: connected || connecting ? 'block' : 'none' }}
            />
        </div>
    );
}
