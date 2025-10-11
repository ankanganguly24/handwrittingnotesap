import { useState, useRef, useCallback } from 'react';

export default function useCanvasEngine() {
  const [currentStroke, setCurrentStroke] = useState([]);
  const [history, setHistory] = useState([]);
  const redoStack = useRef([]);

  const addPoint = useCallback((point) => {
    setCurrentStroke(prev => [...prev, point]);
  }, []);

  const endStroke = useCallback(() => {
    if (currentStroke.length === 0) return;

    setHistory(prev => [...prev, currentStroke]);
    redoStack.current = [];
    setCurrentStroke([]);
  }, [currentStroke]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      redoStack.current.push(last);
      return prev.slice(0, prev.length - 1);
    });
  }, []);

  const redo = useCallback(() => {
    const last = redoStack.current.pop();
    if (!last) return;
    setHistory(prev => [...prev, last]);
  }, []);

  const clear = useCallback(() => {
    setCurrentStroke([]);
    setHistory([]);
    redoStack.current = [];
  }, []);

  return [currentStroke, addPoint, endStroke, undo, redo, clear, history];
}
