import * as Y from 'yjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

/**
 * Local-only CRDT engine for offline-first collaboration simulation.
 */
export const useCollaborationEngine = (docKey = 'yjs_canvas_doc') => {
  const ydoc = useRef(new Y.Doc()).current;
  const strokes = ydoc.getArray('strokes');
  const [localStrokes, setLocalStrokes] = useState([]);
  const isEnabled = docKey !== null && docKey !== undefined;

  // 🔹 Load persisted CRDT state on startup
  useEffect(() => {
    if (!isEnabled) return;

    const loadDoc = async () => {
      try {
        const stored = await AsyncStorage.getItem(docKey);
        if (stored) {
          const update = Uint8Array.from(JSON.parse(stored));
          Y.applyUpdate(ydoc, update);
        }
        setLocalStrokes([...strokes.toArray()]);
      } catch (err) {
        console.error('Error loading CRDT state:', err);
      }
    };

    loadDoc();

    // 🔹 Observe changes and persist automatically
    const observer = () => {
      if (!isEnabled) return;
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        AsyncStorage.setItem(docKey, JSON.stringify(Array.from(update)));
        setLocalStrokes([...strokes.toArray()]);
      } catch (err) {
        console.error('Error persisting CRDT state:', err);
      }
    };

    strokes.observe(observer);

    return () => strokes.unobserve(observer);
  }, [docKey, isEnabled]);

  // 🔹 Actions
  const addStroke = (stroke) => {
    if (!isEnabled) return;
    ydoc.transact(() => {
      strokes.push([stroke]);
    });
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
  };

  const simulateMerge = async (otherDocKey) => {
    if (!isEnabled) return;
    // Optional: Simulate merging from another user/device
    try {
      const stored = await AsyncStorage.getItem(otherDocKey);
      if (!stored) return;
      const update = Uint8Array.from(JSON.parse(stored));
      Y.applyUpdate(ydoc, update);
      console.log('Merged CRDT data from', otherDocKey);
    } catch (err) {
      console.error('Merge failed:', err);
    }
  };

  return {
    localStrokes,
    addStroke,
    clearCanvas,
    getAllStrokes,
    undoLastStroke,
    simulateMerge,
    isEnabled,
  };
};
