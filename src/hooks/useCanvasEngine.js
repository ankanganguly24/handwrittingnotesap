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
    try {
      console.log('[CanvasEngine] Loading strokes:', strokes);
      
      // Defensive filtering to ensure only valid stroke arrays are loaded
      const validStrokes = strokes
        .filter(stroke => {
          if (!Array.isArray(stroke)) {
            console.log('[CanvasEngine] Invalid stroke (not array):', stroke);
            return false;
          }
          if (stroke.length === 0) {
            console.log('[CanvasEngine] Empty stroke array');
            return false;
          }
          // Check if all points in the stroke are valid
          const allPointsValid = stroke.every(point => {
            if (!point || typeof point !== 'object') {
              console.log('[CanvasEngine] Invalid point (not object):', point);
              return false;
            }
            if (typeof point.x !== 'number' || typeof point.y !== 'number') {
              console.log('[CanvasEngine] Invalid point (not numbers):', point);
              return false;
            }
            if (isNaN(point.x) || isNaN(point.y)) {
              console.log('[CanvasEngine] Invalid point (NaN):', point);
              return false;
            }
            return true;
          });
          
          if (!allPointsValid) {
            console.log('[CanvasEngine] Stroke contains invalid points:', stroke);
            return false;
          }
          
          return true;
        })
        .map(stroke => {
          // Create a clean copy of each stroke with only valid points
          return stroke.filter(point => 
            point && 
            typeof point === 'object' && 
            typeof point.x === 'number' && 
            typeof point.y === 'number' &&
            !isNaN(point.x) && 
            !isNaN(point.y)
          );
        })
        .filter(stroke => stroke.length > 0); // Remove any strokes that became empty after filtering
    
      console.log('[CanvasEngine] Valid strokes after filtering:', validStrokes.length);
      
      historyRef.current = validStrokes;
      redoStackRef.current = [];
      currentStrokeRef.current = [];
      setCurrentStroke([]);
    } catch (error) {
      console.error('[CanvasEngine] Error in loadStrokes:', error);
      console.error('[CanvasEngine] Input strokes that caused error:', strokes);
      
      // Fallback: clear everything
      historyRef.current = [];
      redoStackRef.current = [];
      currentStrokeRef.current = [];
      setCurrentStroke([]);
    }
  };

  const getAllStrokes = () => {
    return historyRef.current;
  };

  return [currentStroke, addPoint, endStroke, undo, redo, clear, getAllStrokes, loadStrokes];
};

export default useCanvasEngine;