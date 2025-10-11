// src/hooks/useCanvasEngine.js
import { useState, useRef } from 'react';

const useCanvasEngine = () => {
  const [currentStroke, setCurrentStroke] = useState([]);
  const currentStrokeRef = useRef([]); // Add ref to track current stroke immediately
  const historyRef = useRef([]);
  const redoStackRef = useRef([]);

  const addPoint = (point) => {
    const newStroke = [...currentStrokeRef.current, point];
    currentStrokeRef.current = newStroke; // Update ref immediately
    setCurrentStroke(newStroke);
  };

  const endStroke = () => {
    const strokeToSave = [...currentStrokeRef.current]; // Use ref for immediate access
    
    if (strokeToSave.length > 0) {
      historyRef.current = [...historyRef.current, strokeToSave];
      redoStackRef.current = [];
    }
    
    currentStrokeRef.current = [];
    setCurrentStroke([]);
  };

  const undo = () => {
    if (historyRef.current.length > 0) {
      const lastStroke = historyRef.current.pop();
      redoStackRef.current.push(lastStroke);
      setCurrentStroke([]);
    }
  };

  const redo = () => {
    if (redoStackRef.current.length > 0) {
      const lastRedo = redoStackRef.current.pop();
      historyRef.current.push(lastRedo);
      setCurrentStroke([]);
    }
  };

  const clear = () => {
    historyRef.current = [];
    redoStackRef.current = [];
    currentStrokeRef.current = [];
    setCurrentStroke([]);
  };

  const loadStrokes = (strokes) => {
    historyRef.current = strokes.map(stroke => [...stroke.points]);
    redoStackRef.current = [];
    setCurrentStroke([]);
  };

  const getAllStrokes = () => {
    return historyRef.current;
  };

  return [currentStroke, addPoint, endStroke, undo, redo, clear, getAllStrokes, loadStrokes];
};

export default useCanvasEngine;