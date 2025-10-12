import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Y from 'yjs';
import * as SQLite from 'expo-sqlite';

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

  useEffect(() => {
    if (!enabled) {
      shouldReconnectRef.current = false;
      setConnectionStatus('disabled');
      return;
    }

    let validRoomId = roomId;
    
    if (!roomId || 
        roomId === 'null' || 
        roomId === 'undefined' || 
        typeof roomId !== 'string' || 
        roomId.trim() === '') {
      validRoomId = 'collab_room_main';
    }

    const trimmedRoomId = validRoomId.trim();

    isMountedRef.current = true;
    shouldReconnectRef.current = true;

    const cacheKey = trimmedRoomId;
    let yDoc = connectionCache.get(`${cacheKey}_doc`);
    let ws = connectionCache.get(`${cacheKey}_ws`);

    if (!yDoc) {
      yDoc = new Y.Doc();
      connectionCache.set(`${cacheKey}_doc`, yDoc);
    }

    yDocRef.current = yDoc;
    yStrokesRef.current = yDoc.getArray('strokes');
    yUsersRef.current = yDoc.getMap('users');

    const connectWebSocket = () => {
      if (!isMountedRef.current || !shouldReconnectRef.current) {
        return;
      }

      if (ws && ws.readyState === 1) {
        wsRef.current = ws;
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        if (yUsersRef.current) {
          yUsersRef.current.set(currentUserId, {
            id: currentUserId,
            joinedAt: Date.now(),
            lastSeen: Date.now()
          });
        }
        return;
      }

      if (isConnectingRef.current || reconnectAttemptsRef.current >= maxReconnectAttempts) {
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionStatus('failed');
          shouldReconnectRef.current = false;
        }
        return;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      try {
        isConnectingRef.current = true;
        setConnectionStatus('connecting');
        reconnectAttemptsRef.current += 1;

        if (typeof global.WebSocket === 'undefined') {
          throw new Error('WebSocket is not available in this environment');
        }

        const wsUrl = `ws://192.168.29.215:1234/${encodeURIComponent(trimmedRoomId)}`;
        
        const newWs = new global.WebSocket(wsUrl);
        wsRef.current = newWs;

        const connectionTimer = setTimeout(() => {
          if (newWs.readyState === 0) {
            newWs.close();
            isConnectingRef.current = false;
            setConnectionStatus('error');
            scheduleReconnect();
          }
        }, 15000);

        newWs.onopen = () => {
          console.log(`[RTC] WebSocket connected to room: ${trimmedRoomId}`);
          if (!isMountedRef.current) {
            newWs.close();
            return;
          }
          
          clearTimeout(connectionTimer);
          isConnectingRef.current = false;
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          
          connectionCache.set(`${cacheKey}_ws`, newWs);
          
          if (yUsersRef.current) {
            yUsersRef.current.set(currentUserId, {
              id: currentUserId,
              joinedAt: Date.now(),
              lastSeen: Date.now()
            });
          }
          
          const update = Y.encodeStateAsUpdate(yDoc);
          if (update.length > 2) {
            newWs.send(JSON.stringify(Array.from(update)));
          }
          
          syncOfflineStrokes();
        };

        newWs.onmessage = (event) => {
          if (!isMountedRef.current) return;

          try {
            const data = event.data;
            console.log(`[RTC] Received message: ${data}`);

            if (data.includes('room-info')) {
              const info = JSON.parse(data);
              console.log(`[RTC] Room info: ${JSON.stringify(info)}`);
              return;
            }

            if (!data || data === '[]' || data === '[0,0]') {
              console.log('[RTC] Ignoring empty or invalid message.');
              return;
            }

            const update = new Uint8Array(JSON.parse(data));
            if (update.length <= 2) {
              console.log('[RTC] Ignoring small update.');
              return;
            }

            Y.applyUpdate(yDoc, update, 'server');
            console.log('[RTC] Applied update to Y.Doc.');
          } catch (error) {
            console.error(`[RTC] Error processing message: ${error.message}`);
          }
        };

        newWs.onerror = (error) => {
          console.error(`[RTC] WebSocket error: ${error.message}`);
          clearTimeout(connectionTimer);
          isConnectingRef.current = false;
          if (isMountedRef.current) {
            setConnectionStatus('error');
            scheduleReconnect();
          }
        };

        newWs.onclose = (event) => {
          console.log(`[RTC] WebSocket closed: ${event.code} - ${event.reason}`);
          clearTimeout(connectionTimer);
          isConnectingRef.current = false;
          
          if (connectionCache.get(`${cacheKey}_ws`) === newWs) {
            connectionCache.delete(`${cacheKey}_ws`);
          }
          
          if (!isMountedRef.current) {
            return;
          }
          
          if (event.code === 1000 && event.reason === 'Component unmounted') {
            setConnectionStatus('disconnected');
            return;
          }
          
          setConnectionStatus('error');
          if (shouldReconnectRef.current) {
            scheduleReconnect();
          }
        };

        const updateHandler = (update, origin) => {
          console.log(`[RTC] Y.Doc update triggered. Origin: ${origin}`);
          if (newWs && newWs.readyState === 1 && origin !== 'server') {
            if (update.length > 2) {
              newWs.send(JSON.stringify(Array.from(update)));
              console.log('[RTC] Sent update to server.');
            }
          }
        };

        yDoc.on('update', updateHandler);

        return () => {
          yDoc.off('update', updateHandler);
          clearTimeout(connectionTimer);
        };

      } catch (error) {
        isConnectingRef.current = false;
        if (isMountedRef.current) {
          setConnectionStatus('error');
          scheduleReconnect();
        }
      }
    };

    const strokeObserver = () => {
      if (!isMountedRef.current) return;

      const strokesRaw = yStrokesRef.current.toArray();
      console.log('[RTC] Yjs raw strokes array:', strokesRaw);

      // Each entry is an array of points, so wrap as { points: [...] }
      const strokes = strokesRaw
        .filter(arr => Array.isArray(arr) && arr.length > 0)
        .map(arr => ({ points: arr }));

      console.log('[RTC] Observed strokes in Yjs document:', strokes);

      setLocalStrokes(strokes);
    };

    const userObserver = () => {
      if (!isMountedRef.current) return;
      
      const users = [];
      yUsersRef.current.forEach((user, userId) => {
        if (Date.now() - user.lastSeen < 60000) {
          users.push({
            id: userId,
            ...user
          });
        }
      });
      
      setConnectedUsers([...users]);
    };

    yStrokesRef.current.observe(strokeObserver);
    yUsersRef.current.observe(userObserver);
    
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
    
    connectWebSocket();

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
      
      if (yUsersRef.current) {
        yUsersRef.current.delete(currentUserId);
      }
      
      yStrokesRef.current?.unobserve(strokeObserver);
      yUsersRef.current?.unobserve(userObserver);
      clearInterval(keepAliveInterval);
      
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      
      setTimeout(() => {
        const remainingUsers = [];
        try {
          yUsersRef.current?.forEach((user) => {
            if (Date.now() - user.lastSeen < 30000) {
              remainingUsers.push(user);
            }
          });
        } catch (e) {}
        
        if (remainingUsers.length === 0) {
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

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (shouldReconnectRef.current && enabled && roomId && !isConnectingRef.current && isMountedRef.current) {}
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
    } catch (error) {}
  };

  const saveOfflineStroke = async (stroke) => {
    if (!dbRef.current) return;

    try {
      await dbRef.current.runAsync(
        'INSERT INTO offline_strokes (room_id, stroke_data, timestamp) VALUES (?, ?, ?)',
        [roomId, JSON.stringify(stroke), Date.now()]
      );
    } catch (error) {}
  };

  const addStroke = useCallback(
    (stroke) => {
      console.log('[RTC] Adding stroke:', stroke);
      if (!enabled || !yStrokesRef.current) {
        console.log('[RTC] addStroke skipped: Collaboration is disabled or yStrokesRef is null.');
        return;
      }
      // Only push if stroke and stroke.points are valid and non-empty
      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return;
      try {
        // Defensive: ensure no undefined or empty arrays are pushed
        const validPoints = stroke.points.filter(
          p => p && typeof p.x === 'number' && typeof p.y === 'number'
        );
        if (!Array.isArray(validPoints) || validPoints.length === 0) return;
        // Defensive: do not push undefined or empty arrays
        yStrokesRef.current.push([validPoints]);
        console.log('[RTC] Stroke points added to Yjs document:', stroke.points);

        if (wsRef.current && wsRef.current.readyState === 1) {
          const update = Y.encodeStateAsUpdate(yDocRef.current);
          wsRef.current.send(JSON.stringify(Array.from(update)));
          console.log('[RTC] Sent update to server.');
        }
      } catch (error) {
        console.error('[RTC] Error adding stroke:', error.message);
        saveOfflineStroke(stroke.points);
        setLocalStrokes((prev) => [...prev, { points: stroke.points }]);
      }
    },
    [enabled, currentUserId]
  );

  const addPointToStroke = useCallback(
    (point) => {
      if (!enabled || !yStrokesRef.current || !point) return;
      const lastIndex = yStrokesRef.current.length - 1;
      if (lastIndex < 0) return;
      const lastStrokeArr = yStrokesRef.current.get(lastIndex);
      if (!Array.isArray(lastStrokeArr) || lastStrokeArr.length === 0) return;
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
      lastStrokeArr.push(point);
      yStrokesRef.current.delete(lastIndex, 1);
      yStrokesRef.current.insert(lastIndex, [lastStrokeArr]);

      // Propagate update
      if (wsRef.current && wsRef.current.readyState === 1) {
        const update = Y.encodeStateAsUpdate(yDocRef.current);
        wsRef.current.send(JSON.stringify(Array.from(update)));
      }
    },
    [enabled]
  );

  const clearCanvas = useCallback(() => {
    if (!enabled || !yStrokesRef.current) return;
    
    try {
      yStrokesRef.current.delete(0, yStrokesRef.current.length);
      setLocalStrokes([]);
    } catch (error) {
      setLocalStrokes([]);
    }
  }, [enabled, roomId]);

  const undoLastStroke = useCallback(() => {
    if (!enabled || !yStrokesRef.current || yStrokesRef.current.length === 0) return;

    try {
      yStrokesRef.current.delete(yStrokesRef.current.length - 1, 1);

      // Immediately propagate the update to the server
      if (wsRef.current && wsRef.current.readyState === 1) {
        const update = Y.encodeStateAsUpdate(yDocRef.current);
        wsRef.current.send(JSON.stringify(Array.from(update)));
      }
    } catch (error) {}
  }, [enabled]);

  const syncStrokesToYjs = useCallback(
    (strokesToSync) => {
      if (!enabled || !yStrokesRef.current || !Array.isArray(strokesToSync)) return;
      
      console.log('[RTC] syncStrokesToYjs input:', strokesToSync);
      
      try {
        // Clear existing strokes safely
        const currentLength = yStrokesRef.current.length;
        if (currentLength > 0) {
          yStrokesRef.current.delete(0, currentLength);
        }
        
        // Process each stroke - they should be arrays of points from getAllStrokes()
        strokesToSync.forEach(stroke => {
          // getAllStrokes() returns arrays of points directly
          if (Array.isArray(stroke) && stroke.length > 0) {
            // Validate all points in the stroke
            const validPoints = stroke.filter(p => 
              p && 
              typeof p === 'object' && 
              typeof p.x === 'number' && 
              typeof p.y === 'number' &&
              !isNaN(p.x) && 
              !isNaN(p.y)
            );
            
            if (validPoints.length > 0) {
              console.log('[RTC] Pushing valid stroke with', validPoints.length, 'points');
              yStrokesRef.current.push([validPoints]);
            }
          }
        });
        
        console.log('[RTC] Yjs array after sync:', yStrokesRef.current.toArray());
        
        // Send update to server
        if (wsRef.current && wsRef.current.readyState === 1) {
          const update = Y.encodeStateAsUpdate(yDocRef.current);
          if (update && update.length > 2) {
            wsRef.current.send(JSON.stringify(Array.from(update)));
          }
        }
        
      } catch (error) {
        console.error('[RTC] Error syncing strokes:', error.message);
        // Reset on error
        try {
          yStrokesRef.current.delete(0, yStrokesRef.current.length);
        } catch (resetError) {
          console.error('[RTC] Error resetting Yjs array:', resetError.message);
        }
      }
    },
    [enabled]
  );

  return {
    localStrokes,
    connectedUsers,
    connectionStatus,
    collaborationStats,
    currentUserId,
    addStroke,
    addPointToStroke,
    clearCanvas,
    undoLastStroke,
    syncStrokesToYjs,
    isConnected: connectionStatus === 'connected',
    roomId,
  };
}