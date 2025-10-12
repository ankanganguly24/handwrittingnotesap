import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Platform } from 'react-native';

/**
 * Real-time collaboration service using WebSockets
 */
class CollaborationService {
  constructor() {
    this.providers = new Map();
    this.isConnected = false;
  }

  /**
   * Connect to a collaboration room
   */
  connectToRoom(roomId, ydoc, options = {}) {
    const {
      serverUrl = 'wss://demos.yjs.dev', // Public Yjs demo server
      onConnect = () => {},
      onDisconnect = () => {},
      onError = () => {}
    } = options;

    if (this.providers.has(roomId)) {
      console.log(`Already connected to room: ${roomId}`);
      return this.providers.get(roomId);
    }

    try {
      const provider = new WebsocketProvider(serverUrl, roomId, ydoc, {
        connect: true,
        params: {
          userId: this.generateUserId(),
          platform: Platform.OS,
          timestamp: Date.now()
        }
      });

      provider.on('status', (event) => {
        console.log(`Collaboration status for ${roomId}:`, event.status);
        this.isConnected = event.status === 'connected';
        
        if (event.status === 'connected') {
          onConnect(roomId);
        } else if (event.status === 'disconnected') {
          onDisconnect(roomId);
        }
      });

      provider.on('connection-error', (error) => {
        console.error(`Connection error for ${roomId}:`, error);
        onError(error);
      });

      this.providers.set(roomId, provider);
      return provider;
    } catch (error) {
      console.error('Failed to connect to collaboration room:', error);
      onError(error);
      return null;
    }
  }

  /**
   * Disconnect from a collaboration room
   */
  disconnectFromRoom(roomId) {
    const provider = this.providers.get(roomId);
    if (provider) {
      provider.disconnect();
      provider.destroy();
      this.providers.delete(roomId);
      console.log(`Disconnected from room: ${roomId}`);
    }
  }

  /**
   * Disconnect from all rooms
   */
  disconnectAll() {
    for (const [roomId, provider] of this.providers) {
      provider.disconnect();
      provider.destroy();
    }
    this.providers.clear();
    this.isConnected = false;
  }

  /**
   * Get connection status for a room
   */
  getConnectionStatus(roomId) {
    const provider = this.providers.get(roomId);
    return provider ? provider.wsconnected : false;
  }

  /**
   * Generate unique user ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get list of connected users (if supported by server)
   */
  getConnectedUsers(roomId) {
    const provider = this.providers.get(roomId);
    if (provider && provider.awareness) {
      return Array.from(provider.awareness.getStates().keys());
    }
    return [];
  }
}

export default new CollaborationService();
