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
  const [strokes, setStrokes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentStroke, addPoint, endStroke, undo, redo, clear] = useCanvasEngine();

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
        console.log('[PanResponder] grant - raw coords:', { locationX, locationY, pageX, pageY });
        // Use locationX/locationY since the overlay is positioned relative to the wrapper
        const x = locationX || 0;
        const y = locationY || 0;
        setTouchDebug(`Touch at ${Math.round(x)}, ${Math.round(y)}`);
        addPoint({ x, y });
      },
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
        // Use locationX/locationY since the overlay is positioned relative to the wrapper
        const x = locationX || 0;
        const y = locationY || 0;
        // console.log('[PanResponder] move', Math.round(x), Math.round(y));
        addPoint({ x, y });
      },
      onPanResponderRelease: (evt, gestureState) => {
        console.log('[PanResponder] release');
        onStrokeEnd();
      },
      onPanResponderTerminate: (evt, gestureState) => {
        console.log('[PanResponder] terminate');
        onStrokeEnd();
      },
    })
  ).current;

  useEffect(() => {
    const loadStrokes = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setStrokes(JSON.parse(stored));
      } catch (err) {
        console.log('Error loading strokes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStrokes();
  }, []);

  useEffect(() => {
    const saveStrokes = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(strokes));
      } catch (err) {
        console.log('Error saving strokes:', err);
      }
    };
    saveStrokes();
  }, [strokes]);

  const pointsToSvgPath = points => {
    if (!points || points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };


  const onStrokeEnd = useCallback(() => {
    if (currentStroke.length > 0) {
      const svg = pointsToSvgPath(currentStroke);
      setStrokes(prev => [...prev, { path: svg, width: 3, color: 'black' }]);
      endStroke();
    }
  }, [currentStroke, endStroke]);

  const handleClear = () => {
    clear();
    setStrokes([]);
  };
  const handleUndo = () => {
    undo();
    setStrokes(prev => prev.slice(0, prev.length - 1));
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
          console.log('canvas layout', layout);
        }}
        pointerEvents="box-none"
      >
        <Canvas style={GlobalStyles.canvasContainer}>
          {strokes.map((stroke, idx) => {
            const pathStr = typeof stroke.path === 'string' ? stroke.path : pointsToSvgPath(stroke.path);
            return (
              <Path
                key={idx}
                path={pathStr}
                color={stroke.color || 'black'}
                style="stroke"
                strokeWidth={stroke.width || 3}
              />
            );
          })}

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
