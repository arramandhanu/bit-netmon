"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
const WS_URL = configuredWsUrl
  ? configuredWsUrl
  : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";

interface DeviceUpdate {
  deviceId: number;
  status: string;
  cpu?: number | null;
  memoryPercent?: number | null;
  responseTime: number;
  interfacesPolled: number;
  timestamp: string;
}

interface DeviceDownEvent {
  deviceId: number;
  status: "down";
  responseTime: number;
  timestamp: string;
}

interface AlertEvent {
  id: number;
  ruleName: string;
  severity: string;
  deviceId: number;
  state: string;
  message: string;
  timestamp: string;
}

type EventHandlers = {
  onDeviceUpdate?: (data: DeviceUpdate) => void;
  onDeviceDown?: (data: DeviceDownEvent) => void;
  onAlert?: (data: AlertEvent) => void;
};

/**
 * Hook to connect to the /metrics WebSocket namespace.
 *
 * Usage:
 * ```tsx
 * const { isConnected, subscribeDevice, unsubscribeDevice } = useSocket({
 *   onDeviceUpdate: (data) => console.log('Update:', data),
 *   onDeviceDown: (data) => console.log('Down:', data),
 *   onAlert: (data) => console.log('Alert:', data),
 * });
 * ```
 */
export function useSocket(handlers?: EventHandlers) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store handlers in ref to avoid re-subscriptions on handler change
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io(`${WS_URL}/metrics`, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("deviceUpdate", (data: DeviceUpdate) => {
      handlersRef.current?.onDeviceUpdate?.(data);
    });

    socket.on("deviceDown", (data: DeviceDownEvent) => {
      handlersRef.current?.onDeviceDown?.(data);
    });

    socket.on("alert", (data: AlertEvent) => {
      handlersRef.current?.onAlert?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribeDevice = useCallback((deviceId: number) => {
    socketRef.current?.emit("subscribeDevice", { deviceId });
  }, []);

  const unsubscribeDevice = useCallback((deviceId: number) => {
    socketRef.current?.emit("unsubscribeDevice", { deviceId });
  }, []);

  return {
    isConnected,
    socket: socketRef.current,
    subscribeDevice,
    unsubscribeDevice,
  };
}
