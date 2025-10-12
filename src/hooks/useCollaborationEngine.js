import * as Y from 'yjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

export const useCollaborationEngine = (docKey = 'yjs_canvas_doc', isCollaborative = false) => {
  const ydoc = useRef(new Y.Doc()).current;
  const strokes = ydoc.getArray('strokes');
  const [localStrokes, setLocalStrokes] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const isEnabled = Boolean(isCollaborative && 
                           docKey && 
                           docKey !== 'null' && 
                           docKey !== 'undefined' &&
                           typeof docKey === 'string' && 
                           docKey.trim().length > 0);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const loadDoc = async () => {
      try {
        const stored = await AsyncStorage.getItem(docKey);
        if (stored) {
          const update = Uint8Array.from(JSON.parse(stored));
          Y.applyUpdate(ydoc, update);
        }
        setLocalStrokes([...strokes.toArray()]);
      } catch (err) {}
    };

    loadDoc();

    const observer = () => {
      if (!isEnabled) return;
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        AsyncStorage.setItem(docKey, JSON.stringify(Array.from(update)));
        // Flatten strokes array and filter out empty strokes
        setLocalStrokes([...strokes.toArray().flat().filter(s => s && s.points && s.points.length > 0)]);
      } catch (err) {}
    };

    strokes.observe(observer);

    return () => {
      strokes.unobserve(observer);
    };
  }, [docKey, isEnabled]);

  const addStroke = (stroke) => {
    if (!isEnabled) return;
    
    const normalizedStroke = {
      points: stroke.points || [],
      path: stroke.path || '',
      color: stroke.color || 'black',
      width: stroke.width || 3,
      userId: stroke.userId || 'unknown',
      timestamp: stroke.timestamp || Date.now(),
    };
    
    ydoc.transact(() => {
      strokes.push([normalizedStroke]);
    });

    // Immediately propagate the update
    const update = Y.encodeStateAsUpdate(ydoc);
    AsyncStorage.setItem(docKey, JSON.stringify(Array.from(update)));
  };

  const clearCanvas = () => {
    if (!isEnabled) return;
    ydoc.transact(() => {
      strokes.delete(0, strokes.length);
    });
  };

  const getAllStrokes = () => {
    if (!isEnabled) return [];
    return [...strokes.toArray()];
  };

  const undoLastStroke = () => {
    if (!isEnabled || strokes.length === 0) return;
    ydoc.transact(() => {
      strokes.delete(strokes.length - 1, 1);
    });

    // Immediately propagate the update
    const update = Y.encodeStateAsUpdate(ydoc);
    AsyncStorage.setItem(docKey, JSON.stringify(Array.from(update)));
  };

  const simulateMerge = async (otherDocKey) => {
    if (!isEnabled) return;
    try {
      const stored = await AsyncStorage.getItem(otherDocKey);
      if (!stored) return;
      const update = Uint8Array.from(JSON.parse(stored));
      Y.applyUpdate(ydoc, update);
    } catch (err) {}
  };

  return {
    localStrokes,
    addStroke,
    clearCanvas,
    getAllStrokes,
    undoLastStroke,
    simulateMerge,
    isEnabled,
    connectionStatus,
    ydoc,
    yStrokes: strokes,
  };
};