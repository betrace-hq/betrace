import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fluoWebSocket, type WebSocketMessage } from '../websocket/client';
import { useAuth } from '../auth/auth-context';
import { signalsKeys } from './use-signals';
import { rulesKeys } from './use-rules';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason?: string) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onConnect, onDisconnect, onError } = options;
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  const connect = useCallback(async () => {
    try {
      if (tenant?.id) {
        fluoWebSocket.updateTenant(tenant.id);
      }
      await fluoWebSocket.connect();
      onConnect?.();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      onError?.(error);
    }
  }, [tenant?.id, onConnect, onError]);

  const disconnect = useCallback(() => {
    fluoWebSocket.disconnect();
    onDisconnect?.();
  }, [onDisconnect]);

  const subscribe = useCallback((messageType: string, handler: (data: any) => void) => {
    const unsubscribe = fluoWebSocket.subscribe(messageType, handler);
    unsubscribeRefs.current.push(unsubscribe);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Set up default message handlers for cache invalidation
    const unsubscribes: (() => void)[] = [];

    // Handle signal updates
    unsubscribes.push(
      fluoWebSocket.subscribe('signal_update', (data) => {
        console.log('Signal updated:', data);

        // Update specific signal in cache if we have it
        if (data.id) {
          queryClient.setQueryData(signalsKeys.detail(data.id), data);
        }

        // Invalidate signals list to refetch
        queryClient.invalidateQueries({ queryKey: signalsKeys.lists() });
        queryClient.invalidateQueries({ queryKey: signalsKeys.stats() });
      })
    );

    // Handle new signals
    unsubscribes.push(
      fluoWebSocket.subscribe('signal_created', (data) => {
        console.log('New signal created:', data);

        // Invalidate signals list and stats to show new signal
        queryClient.invalidateQueries({ queryKey: signalsKeys.lists() });
        queryClient.invalidateQueries({ queryKey: signalsKeys.stats() });
      })
    );

    // Handle rule updates
    unsubscribes.push(
      fluoWebSocket.subscribe('rule_updated', (data) => {
        console.log('Rule updated:', data);

        // Update specific rule in cache if we have it
        if (data.id) {
          queryClient.setQueryData(rulesKeys.detail(data.id), data);
        }

        // Invalidate rules list to refetch
        queryClient.invalidateQueries({ queryKey: rulesKeys.lists() });
      })
    );

    // Handle connection status
    unsubscribes.push(
      fluoWebSocket.subscribe('connection_status', (data) => {
        console.log('WebSocket connection status:', data.status);

        if (data.status === 'connected') {
          onConnect?.();
        } else if (data.status === 'disconnected') {
          onDisconnect?.(data.reason);
        }
      })
    );

    // Store unsubscribe functions
    unsubscribeRefs.current.push(...unsubscribes);

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    return () => {
      // Clean up all subscriptions
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
      unsubscribeRefs.current = [];
    };
  }, [queryClient, autoConnect, connect, onConnect, onDisconnect]);

  // Update tenant when it changes
  useEffect(() => {
    if (tenant?.id && fluoWebSocket.isConnected()) {
      fluoWebSocket.updateTenant(tenant.id);
    }
  }, [tenant?.id]);

  return {
    connect,
    disconnect,
    subscribe,
    isConnected: fluoWebSocket.isConnected(),
  };
}