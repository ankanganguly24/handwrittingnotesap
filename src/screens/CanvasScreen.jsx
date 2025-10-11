import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Alert, SafeAreaView, Text, TouchableOpacity, PanResponder } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { useNavigation } from '@react-navigation/native';
import GlobalStyles from '../styles/GlobalStyles';
import Toolbar from '../components/Toolbar';
import StrokePreview from '../components/StrokePreview';
import Loader from '../components/Loader';
import DebugPanel from '../components/DebugPanel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useCanvasEngine from '../hooks/useCanvasEngine';
import useNetworkStatus from '../hooks/useNetworkStatus';

const STORAGE_KEY = '@handwriting_strokes';

export default function CanvasScreen({ route }) {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [editingDrawing, setEditingDrawing] = useState(null);
  
  const [currentStroke, addPoint, endStroke, undo, redo, clear, getAllStrokes, loadStrokes] = useCanvasEngine();

  const { isConnected } = useNetworkStatus();
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
        // Check if we're in edit mode
        if (route?.params?.editMode && route?.params?.drawingData) {
          const drawingData = route.params.drawingData;
          setEditingDrawing(drawingData);
          
          // Convert drawing strokes back to points format
          const strokesAsPoints = drawingData.strokes.map(stroke => {
            return svgPathToPoints(stroke.path);
          });
          
          if (strokesAsPoints.length > 0) {
            loadStrokes(strokesAsPoints);
          }
        } else {
          // Normal loading from storage
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsedStrokes = JSON.parse(stored);
            if (parsedStrokes.length > 0) {
              loadStrokes(parsedStrokes);
            }
          }
        }
      } catch (err) {
        console.log('Error loading strokes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStrokesFromStorage();
  }, [route?.params]);

  // Convert SVG path back to points
  const svgPathToPoints = (pathString) => {
    if (!pathString) return [];
    
    const commands = pathString.split(/(?=[ML])/);
    const points = [];
    
    commands.forEach(command => {
      const parts = command.trim().split(' ');
      if (parts.length >= 3) {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        if (!isNaN(x) && !isNaN(y)) {
          points.push({ x, y });
        }
      }
    });
    
    return points;
  };

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
  const handleSave = async () => {
    if (!isConnected) {
      Alert.alert(
        'Offline Mode', 
        'You are currently offline. Drawing will be saved locally and synced when connection is restored.',
        [{ text: 'OK', onPress: () => saveDrawingLocally() }]
      );
      return;
    }

    saveDrawingLocally();
  };

  const saveDrawingLocally = async () => {
    try {
      const allStrokes = getAllStrokes();
      if (allStrokes.length === 0) {
        Alert.alert('Nothing to save', 'Please draw something first!');
        return;
      }

      if (editingDrawing) {
        // Update existing drawing
        const updatedDrawing = {
          ...editingDrawing,
          strokes: allStrokes.map(stroke => ({
            path: pointsToSvgPath(stroke),
            color: 'black',
            width: 3
          })),
          updatedAt: new Date().toISOString()
        };

        const existing = await AsyncStorage.getItem('@saved_drawings');
        const drawings = existing ? JSON.parse(existing) : [];
        const updatedDrawings = drawings.map(drawing => 
          drawing.id === editingDrawing.id ? updatedDrawing : drawing
        );
        
        await AsyncStorage.setItem('@saved_drawings', JSON.stringify(updatedDrawings));
        Alert.alert('Updated!', 'Your drawing has been updated successfully!');
      } else {
        // Save new drawing
        const drawingData = {
          id: Date.now().toString(),
          title: `Drawing ${new Date().toLocaleDateString()}`,
          strokes: allStrokes.map(stroke => ({
            path: pointsToSvgPath(stroke),
            color: 'black',
            width: 3
          })),
          createdAt: new Date().toISOString()
        };

        const existing = await AsyncStorage.getItem('@saved_drawings');
        const drawings = existing ? JSON.parse(existing) : [];
        drawings.push(drawingData);
        await AsyncStorage.setItem('@saved_drawings', JSON.stringify(drawings));
        Alert.alert('Saved!', 'Your drawing has been saved successfully!');
      }
      
      navigation.navigate('Save');
    } catch (error) {
      console.error('Error saving drawing:', error);
      Alert.alert('Error', 'Failed to save drawing');
    }
  };
  const handleNotes = () => {
    if (editingDrawing) {
      // If in edit mode, ask user if they want to save changes first
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard Changes', 
            style: 'destructive',
            onPress: () => {
              resetToNormalMode();
              navigation.navigate('Recognition');
            }
          },
          {
            text: 'Save & Continue',
            onPress: async () => {
              await handleSave();
              navigation.navigate('Recognition');
            }
          }
        ]
      );
    } else {
      navigation.navigate('Recognition');
    }
  };

  // Reset to normal canvas mode
  const resetToNormalMode = () => {
    setEditingDrawing(null);
    clear(); // Clear the canvas
    // Reset navigation params by replacing the current route
    navigation.reset({
      index: 0,
      routes: [{ name: 'Canvas' }]
    });
  };

  if (isLoading) return <Loader message="Loading canvas..." />;

  return (
    <View style={{ ...GlobalStyles.container, paddingTop: 50, paddingBottom: 70 }}>
      {/* Debug Panel */}
      <DebugPanel />
      
      {/* Network Status Indicator */}
      {!isConnected && (
        <View style={styles.offlineIndicator}>
          <Text style={styles.offlineText}>📶 Offline Mode</Text>
        </View>
      )}

      <View style={GlobalStyles.header}>
        {editingDrawing && (
          <TouchableOpacity onPress={resetToNormalMode} style={GlobalStyles.headerButton}>
            <Text style={GlobalStyles.headerButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        
        <Text style={[GlobalStyles.headerTitle, { flex: 1, textAlign: 'center' }]}>
          {editingDrawing ? `✏️ Editing: ${editingDrawing.title}` : '✍️ Whats on your mind?'}
        </Text>
        
        <TouchableOpacity onPress={handleNotes} style={GlobalStyles.headerButton}>
          <Text style={GlobalStyles.headerButtonText}>Notes</Text>
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
        allStrokes={getAllStrokes()}
        currentStroke={currentStroke}
        canvasLayout={canvasLayout}
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

const styles = {
  offlineIndicator: {
    position: 'absolute',
    top: 200,
    left: 10,
    backgroundColor: '#dc3545',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1000,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
};

