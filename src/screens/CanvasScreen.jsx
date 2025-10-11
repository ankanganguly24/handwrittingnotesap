import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Alert, SafeAreaView, Text, TouchableOpacity, PanResponder } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import GlobalStyles from '../styles/GlobalStyles';
import Toolbar from '../components/Toolbar';
import StrokePreview from '../components/StrokePreview';
import Loader from '../components/Loader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useCanvasEngine from '../hooks/useCanvasEngine';
import useNetworkStatus from '../hooks/useNetworkStatus';

const STORAGE_KEY = '@handwriting_strokes';

export default function CanvasScreen() {
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentStroke, addPoint, endStroke, undo, redo, clear, getAllStrokes, loadStrokes] = useCanvasEngine();

  const networkStatus = useNetworkStatus();
  const canvasRef = useRef(null);
  const [canvasLayout, setCanvasLayout] = useState(null);
  const canvasLayoutRef = useRef(null);
  const [touchDebug, setTouchDebug] = useState('No touch detected');


  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
        const x = locationX || 0;
        const y = locationY || 0;
        setTouchDebug(`Touch at ${Math.round(x)}, ${Math.round(y)}`);
        addPoint({ x, y });
      },
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
        const x = locationX || 0;
        const y = locationY || 0;
        addPoint({ x, y });
      },
      onPanResponderRelease: (evt, gestureState) => {
        onStrokeEnd();
      },
      onPanResponderTerminate: (evt, gestureState) => {
        onStrokeEnd();
      },
    })
  ).current;

  useEffect(() => {
    const loadStrokesFromStorage = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedStrokes = JSON.parse(stored);
          if (parsedStrokes.length > 0) {
            loadStrokes(parsedStrokes);
          }
        }
      } catch (err) {
        console.log('Error loading strokes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStrokesFromStorage();
  }, []); // Remove loadStrokes dependency

  // Create a separate ref to track when we need to save
  const saveTimeoutRef = useRef(null);
  const lastStrokeCountRef = useRef(0);

  useEffect(() => {
    const currentStrokeCount = getAllStrokes().length;
    
    if (currentStrokeCount !== lastStrokeCountRef.current && currentStrokeCount > 0) {
      lastStrokeCountRef.current = currentStrokeCount;
      
      // Debounce saving to avoid too frequent saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const allStrokes = getAllStrokes();
          const strokesToSave = allStrokes.map(stroke => ({
            points: stroke,
            path: pointsToSvgPath(stroke),
            width: 3,
            color: 'black'
          }));
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(strokesToSave));
        } catch (err) {
          console.log('Error saving strokes:', err);
        }
      }, 500); // Save after 500ms of no new strokes
    }
  }, [currentStroke, getAllStrokes().length]); // Depend on stroke count, not the array itself

  const pointsToSvgPath = points => {
    if (!points || points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };


  const onStrokeEnd = useCallback(() => {
    endStroke();
  }, [endStroke]);

  const handleClear = () => {
    clear();
  };

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => redo();
  const handleSave = () => Alert.alert('Saved!', 'Your handwriting has been saved locally.');

  if (isLoading) return <Loader message="Loading canvas..." />;

  return (
    <View style={GlobalStyles.container}>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.headerTitle}>✍️ Whats on your mind?</Text>
        <TouchableOpacity onPress={handleSave} style={GlobalStyles.headerButton}>
          <Text style={GlobalStyles.headerButtonText}>Recents</Text>
        </TouchableOpacity>
      </View>

      <View
        ref={canvasRef}
        style={GlobalStyles.canvasWrapper}
        onLayout={e => {
          const layout = e.nativeEvent.layout;
          setCanvasLayout(layout);
          canvasLayoutRef.current = layout;
        }}
        pointerEvents="box-none"
      >
        <Canvas style={GlobalStyles.canvasContainer}>
          {getAllStrokes().map((stroke, idx) => (
            <Path
              key={idx}
              path={pointsToSvgPath(stroke)}
              color="black"
              style="stroke"
              strokeWidth={3}
            />
          ))}

          {currentStroke.length > 0 && (
            <Path
              path={pointsToSvgPath(currentStroke)}
              color="black"
              style="stroke"
              strokeWidth={3}
            />
          )}
        </Canvas>
        
        {/* Transparent overlay for touch detection */}
        <View 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent'
          }}
          {...panResponder.panHandlers}
        />
      </View>

      <StrokePreview
        strokes={currentStroke.length > 0 ? [{ path: pointsToSvgPath(currentStroke) }] : []}
      />

      <Toolbar
        actions={{
          undo: handleUndo,
          redo: handleRedo,
          clear: handleClear,
          save: handleSave,
        }}
      />
    </View>
  );
}

