import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Alert, SafeAreaView, Text, TouchableOpacity } from 'react-native';
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
          <Text style={GlobalStyles.headerButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View
        ref={canvasRef}
        style={GlobalStyles.canvasWrapper}
        onStartShouldSetResponder={() => true}
        onResponderGrant={e => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          addPoint({ x, y });
        }}
        onResponderMove={e => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          addPoint({ x, y });
        }}
        onResponderRelease={onStrokeEnd}
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
      </View>

      {/* Stroke preview
      <StrokePreview
        strokes={currentStroke.length > 0 ? [{ path: pointsToSvgPath(currentStroke) }] : []}
      /> */}

      {/* Toolbar */}
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
