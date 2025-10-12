import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Y from 'yjs';
import * as SQLite from 'expo-sqlite';

// Global connection cache to persist across component mounts
const connectionCache = new Map();

export const useRealTimeCollaboration = (roomId, enabled = false) => {
  const [localStrokes, setLocalStrokes] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [collaborationStats, setCollaborationStats] = useState({
    totalStrokes: 0,
    localStrokes: 0,
    remoteStrokes: 0,
  });

  const currentUserId = useRef(`user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`).current;
  const yDocRef = useRef(null);
  const wsRef = useRef(null);
  const yStrokesRef = useRef(null);
  const yUsersRef = useRef(null);
  const dbRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const isMountedRef = useRef(true);

  // Initialize SQLite database
  useEffect(() => {
    const initDB = async () => {
      const db = await SQLite.openDatabaseAsync('collaboration.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_strokes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT,
          stroke_data TEXT,
          timestamp INTEGER,
          synced INTEGER DEFAULT 0
        );
      `);
      dbRef.current = db;
    };
    initDB();
  }, []);

  // Initialize Yjs document and WebSocket connection
  useEffect(() => {
    // Simple validation
    if (!enabled) {
      console.log(`❌ Collaboration disabled - enabled: ${enabled}`);
      shouldReconnectRef.current = false;
      setConnectionStatus('disabled');
      return;
    }

    // Enhanced roomId validation with fallback
    let validRoomId = roomId;
    
    if (!roomId || 
        roomId === 'null' || 
        roomId === 'undefined' || 
        typeof roomId !== 'string' || 
        roomId.trim() === '') {
      
      console.log(`⚠️ Invalid roomId provided: "${roomId}", using fallback`);
      validRoomId = 'collab_room_main'; // Fallback to default
    }

    const trimmedRoomId = validRoomId.trim();
    console.log(`🔗 Initializing collaboration for room: "${trimmedRoomId}", user: ${currentUserId}`);

    isMountedRef.current = true;
    shouldReconnectRef.current = true;

    // Use ONLY roomId for cache key (shared across all users in room)
    const cacheKey = trimmedRoomId;
    let yDoc = connectionCache.get(`${cacheKey}_doc`);
    let ws = connectionCache.get(`${cacheKey}_ws`);

    if (!yDoc) {
      yDoc = new Y.Doc();
      connectionCache.set(`${cacheKey}_doc`, yDoc);
      console.log(`📄 Created new Y.Doc for room: ${trimmedRoomId}`);
    } else {
      console.log(`📄 Reusing existing Y.Doc for room: ${trimmedRoomId}`);
    }

    yDocRef.current = yDoc;
    yStrokesRef.current = yDoc.getArray('strokes');
    yUsersRef.current = yDoc.getMap('users');

    const connectWebSocket = () => {
      if (!isMountedRef.current || !shouldReconnectRef.current) {
        console.log('❌ Connection aborted - component unmounted or should not reconnect');
        return;
      }

      // Check if WebSocket exists and is open
      if (ws && ws.readyState === 1) { // WebSocket.OPEN
        wsRef.current = ws;
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        console.log(`✅ Reusing existing WebSocket for room: ${trimmedRoomId}`);
        
        // Register this user in the users map
        if (yUsersRef.current) {
          yUsersRef.current.set(currentUserId, {
            id: currentUserId,
            joinedAt: Date.now(),
            lastSeen: Date.now()
          });
          console.log(`👤 Registered user ${currentUserId} in room ${trimmedRoomId}`);
        }
        return;
      }

      // Prevent multiple simultaneous connection attempts
      if (isConnectingRef.current || reconnectAttemptsRef.current >= maxReconnectAttempts) {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log('❌ Max reconnection attempts reached, switching to offline mode');
          setConnectionStatus('failed');
          shouldReconnectRef.current = false;
        }
        return;
      }

      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      try {
        isConnectingRef.current = true;
        setConnectionStatus('connecting');
        reconnectAttemptsRef.current += 1;
        console.log(`🔄 Connection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} for room ${trimmedRoomId}`);

        if (typeof global.WebSocket === 'undefined') {
          throw new Error('WebSocket is not available in this environment');
        }

        const wsUrl = `ws://192.168.29.215:1234/${encodeURIComponent(trimmedRoomId)}`;
        console.log(`🌐 Connecting to: ${wsUrl}`);
        
        const newWs = new global.WebSocket(wsUrl);
        wsRef.current = newWs;

        // Connection timeout
        const connectionTimer = setTimeout(() => {
          if (newWs.readyState === 0) { // CONNECTING
            console.log('⏱️ Connection timeout for room', trimmedRoomId);
            newWs.close();
            isConnectingRef.current = false;
            setConnectionStatus('error');
            scheduleReconnect();
          }
        }, 15000);

        newWs.onopen = () => {
          if (!isMountedRef.current) {
            console.log('⚠️ WebSocket opened but component unmounted');
            newWs.close();
            return;
          }
          
          console.log(`✅ WebSocket connected to room: ${trimmedRoomId} as user: ${currentUserId}`);
          clearTimeout(connectionTimer);
          isConnectingRef.current = false;
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          
          // Cache the connection (room-level only)
          connectionCache.set(`${cacheKey}_ws`, newWs);
          
          // Register current user in users map
          if (yUsersRef.current) {
            yUsersRef.current.set(currentUserId, {
              id: currentUserId,
              joinedAt: Date.now(),
              lastSeen: Date.now()
            });
            console.log(`👥 User ${currentUserId} joined room ${trimmedRoomId}`);
          }
          
          // Send initial state if document has content
          const update = Y.encodeStateAsUpdate(yDoc);
          if (update.length > 2) {
            newWs.send(JSON.stringify(Array.from(update)));
            console.log(`📤 Sent initial state (${update.length} bytes) to room ${trimmedRoomId}`);
          }
          
          syncOfflineStrokes();
        };

        newWs.onmessage = (event) => {
          if (!isMountedRef.current) return;
          
          try {
            const data = event.data;
            
            // Handle room info messages
            if (data.includes('room-info')) {
              const info = JSON.parse(data);
              console.log(`📊 Room info received:`, info);
              return;
            }
            
            if (!data || data === '[]' || data === '[0,0]') {
              return;
            }
            
            const update = new Uint8Array(JSON.parse(data));
            if (update.length <= 2) {
              return;
            }
            
            Y.applyUpdate(yDoc, update, 'server');
            console.log(`📥 Applied update from server (${update.length} bytes) in room ${roomId}`);
          } catch (error) {
            console.error('❌ Error processing message:', error);
          }
        };

        newWs.onerror = (error) => {
          console.error('❌ WebSocket error for room', roomId, ':', error);
          clearTimeout(connectionTimer);
          isConnectingRef.current = false;
          if (isMountedRef.current) {
            setConnectionStatus('error');
            scheduleReconnect();
          }
        };

        newWs.onclose = (event) => {
          console.log(`🔌 WebSocket closed for room ${roomId}:`, { 
            code: event.code, 
            reason: event.reason,
            wasClean: event.wasClean
          });
          clearTimeout(connectionTimer);
          isConnectingRef.current = false;
          
          // Remove from cache
          if (connectionCache.get(`${cacheKey}_ws`) === newWs) {
            connectionCache.delete(`${cacheKey}_ws`);
          }
          
          if (!isMountedRef.current) {
            console.log('⚠️ Component unmounted, not reconnecting');
            return;
          }
          
          // Don't reconnect if intentionally closed
          if (event.code === 1000 && event.reason === 'Component unmounted') {
            setConnectionStatus('disconnected');
            return;
          }
          
          setConnectionStatus('error');
          if (shouldReconnectRef.current) {
            scheduleReconnect();
          }
        };

        // Set up document update handler
        const updateHandler = (update, origin) => {
          if (newWs && newWs.readyState === 1 && origin !== 'server') { // WebSocket.OPEN
            if (update.length > 2) {
              newWs.send(JSON.stringify(Array.from(update)));
              console.log(`📤 Sent update (${update.length} bytes) to room ${roomId}`);
            }
          }
        };

        yDoc.on('update', updateHandler);

        return () => {
          yDoc.off('update', updateHandler);
          clearTimeout(connectionTimer);
        };

      } catch (error) {
        console.error('❌ WebSocket connection failed for room', trimmedRoomId, ':', error);
        isConnectingRef.current = false;
        if (isMountedRef.current) {
          setConnectionStatus('error');
          scheduleReconnect();
        }
      }
    };

    // Observe stroke changes
    const strokeObserver = () => {
      if (!isMountedRef.current) return;
      
      const strokes = yStrokesRef.current.toArray();
      console.log(`✏️ Strokes updated in room ${trimmedRoomId}: ${strokes.length} total`);
      setLocalStrokes([...strokes]);
      setCollaborationStats((prev) => ({
        ...prev,
        totalStrokes: strokes.length,
        remoteStrokes: strokes.filter((s) => s.userId !== currentUserId).length,
        localStrokes: strokes.filter((s) => s.userId === currentUserId).length,
      }));
    };

    // Observe user changes
    const userObserver = () => {
      if (!isMountedRef.current) return;
      
      const users = [];
      yUsersRef.current.forEach((user, userId) => {
        // Only include users active in last 60 seconds
        if (Date.now() - user.lastSeen < 60000) {
          users.push({
            id: userId,
            ...user
          });
        }
      });
      
      setConnectedUsers([...users]);
      console.log(`👥 Connected users in room ${trimmedRoomId}:`, users.length, users.map(u => u.id));
    };

    yStrokesRef.current.observe(strokeObserver);
    yUsersRef.current.observe(userObserver);
    
    // Keep user alive with periodic heartbeat
    const keepAliveInterval = setInterval(() => {
      if (yUsersRef.current && connectionStatus === 'connected' && isMountedRef.current) {
        const currentUser = yUsersRef.current.get(currentUserId);
        if (currentUser) {
          yUsersRef.current.set(currentUserId, {
            ...currentUser,
            lastSeen: Date.now()
          });
        }
      }
    }, 15000);
    
    // Initial connection
    connectWebSocket();

    // Handle app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        shouldReconnectRef.current = true;
        if (connectionStatus !== 'connected' && !isConnectingRef.current) {
          reconnectAttemptsRef.current = 0;
          connectWebSocket();
        }
      } else if (nextAppState === 'background') {
        shouldReconnectRef.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      shouldReconnectRef.current = false;
      
      console.log(`🔌 Cleanup for user ${currentUserId} in room ${trimmedRoomId}`);
      
      // Remove user from users map
      if (yUsersRef.current) {
        yUsersRef.current.delete(currentUserId);
        console.log(`👋 User ${currentUserId} left room ${trimmedRoomId}`);
      }
      
      yStrokesRef.current?.unobserve(strokeObserver);
      yUsersRef.current?.unobserve(userObserver);
      clearInterval(keepAliveInterval);
      
      // Immediate cleanup - close connection when component unmounts
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      
      // Clean up cache after delay only if no other users
      setTimeout(() => {
        const remainingUsers = [];
        try {
          yUsersRef.current?.forEach((user) => {
            if (Date.now() - user.lastSeen < 30000) {
              remainingUsers.push(user);
            }
          });
        } catch (e) {
          // YDoc might be disposed
        }
        
        if (remainingUsers.length === 0) {
          console.log(`🧹 Cleaning up cache for empty room ${roomId}`);
          connectionCache.delete(`${cacheKey}_ws`);
          connectionCache.delete(`${cacheKey}_doc`);
        }
      }, 1000);
      
      subscription?.remove();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      isConnectingRef.current = false;
    };
  }, [enabled, roomId, currentUserId]);

  const scheduleReconnect = () => {
    if (!shouldReconnectRef.current || 
        !isMountedRef.current ||
        reconnectTimeoutRef.current || 
        reconnectAttemptsRef.current >= maxReconnectAttempts ||
        isConnectingRef.current) {
      return;
    }

    const delay = Math.min(2000 * reconnectAttemptsRef.current, 10000);
    console.log(`⏱️ Scheduling reconnect in ${delay}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (shouldReconnectRef.current && enabled && roomId && !isConnectingRef.current && isMountedRef.current) {
        console.log('🔄 Attempting to reconnect...');
        // The connectWebSocket function will be called in the main useEffect
      }
    }, delay);
  };

  const syncOfflineStrokes = async () => {
    if (!dbRef.current) return;

    try {
      const result = await dbRef.current.getAllAsync(
        'SELECT * FROM offline_strokes WHERE room_id = ? AND synced = 0',
        [roomId]
      );

      for (const row of result) {
        const strokeData = JSON.parse(row.stroke_data);
        yStrokesRef.current?.push([strokeData]);
        await dbRef.current.runAsync(
          'UPDATE offline_strokes SET synced = 1 WHERE id = ?',
          [row.id]
        );
      }
    } catch (error) {
      console.error('Error syncing offline strokes:', error);
    }
  };

  const saveOfflineStroke = async (stroke) => {
    if (!dbRef.current) return;

    try {
      await dbRef.current.runAsync(
        'INSERT INTO offline_strokes (room_id, stroke_data, timestamp) VALUES (?, ?, ?)',
        [roomId, JSON.stringify(stroke), Date.now()]
      );
    } catch (error) {
      console.error('Error saving offline stroke:', error);
    }
  };

  const addStroke = useCallback(
    (stroke) => {
      if (!enabled || !yStrokesRef.current) return;

      const strokeWithUser = {
        points: stroke.points || [],
        path: stroke.path || '',
        color: stroke.color || 'blue',
        width: stroke.width || 3,
        userId: currentUserId,
        timestamp: Date.now(),
      };

      try {
        if (connectionStatus === 'connected') {
          yStrokesRef.current.push([strokeWithUser]);
          console.log(`✏️ Added stroke to room ${roomId} by user ${currentUserId}`);
        } else {
          saveOfflineStroke(strokeWithUser);
          setLocalStrokes((prev) => [...prev, strokeWithUser]);
          console.log(`💾 Saved stroke offline for room ${roomId}`);
        }
      } catch (error) {
        console.error('Error adding stroke:', error);
        saveOfflineStroke(strokeWithUser);
        setLocalStrokes((prev) => [...prev, strokeWithUser]);
      }
    },
    [enabled, connectionStatus, currentUserId, roomId]
  );

  const clearCanvas = useCallback(() => {
    if (!enabled || !yStrokesRef.current) return;
    
    try {
      yStrokesRef.current.delete(0, yStrokesRef.current.length);
      setLocalStrokes([]);
      console.log(`🗑️ Cleared canvas in room ${roomId}`);
    } catch (error) {
      console.error('Error clearing canvas:', error);
      setLocalStrokes([]);
    }
  }, [enabled, roomId]);

  const undoLastStroke = useCallback(() => {
    if (!enabled || !yStrokesRef.current || yStrokesRef.current.length === 0) return;
    
    try {
      yStrokesRef.current.delete(yStrokesRef.current.length - 1, 1);
      console.log(`↶ Undo stroke in room ${roomId}`);
    } catch (error) {
      console.error('Error undoing stroke:', error);
    }
  }, [enabled, roomId]);

  return {
    localStrokes,
    connectedUsers,
    connectionStatus,
    collaborationStats,
    currentUserId,
    addStroke,
    clearCanvas,
    undoLastStroke,
    isConnected: connectionStatus === 'connected',
    roomId,
  };
}