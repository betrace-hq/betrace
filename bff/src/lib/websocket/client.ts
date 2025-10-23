import { API_ENDPOINTS } from '../api/index';

export interface WebSocketMessage {
  type: 'signal_update' | 'signal_created' | 'rule_updated' | 'connection_status';
  data: any;
  timestamp: string;
}

export interface WebSocketConfig {
  url?: string;
  tenantId?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class BeTraceWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private tenantId?: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private messageHandlers = new Map<string, Set<(data: any) => void>>();
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(config: WebSocketConfig = {}) {
    this.url = config.url || API_ENDPOINTS.BETRACE_WS;
    this.tenantId = config.tenantId;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
  }

  connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.buildWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected to BeTrace backend');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.clearReconnectTimer();

          // Send connection status message
          this.notifyHandlers('connection_status', {
            status: 'connected',
            timestamp: new Date().toISOString()
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;

          // Notify connection status handlers
          this.notifyHandlers('connection_status', {
            status: 'disconnected',
            code: event.code,
            reason: event.reason,
            timestamp: new Date().toISOString()
          });

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;

          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(messageType: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }

    this.messageHandlers.get(messageType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(messageType);
        }
      }
    };
  }

  updateTenant(tenantId: string): void {
    this.tenantId = tenantId;

    // Reconnect with new tenant if currently connected
    if (this.isConnected()) {
      this.disconnect();
      this.connect();
    }
  }

  private buildWebSocketUrl(): string {
    const url = new URL(this.url);

    if (this.tenantId) {
      url.searchParams.set('tenantId', this.tenantId);
    }

    return url.toString();
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('Received WebSocket message:', message.type, message.data);
    this.notifyHandlers(message.type, message.data);
  }

  private notifyHandlers(messageType: string, data: any): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket handler for ${messageType}:`, error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts++;

    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);

    this.reconnectTimer = window.setTimeout(() => {
      console.log(`Attempting WebSocket reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect().catch(error => {
        console.error('WebSocket reconnect failed:', error);
      });
    }, this.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Export singleton instance
export const betraceWebSocket = new BeTraceWebSocketClient();