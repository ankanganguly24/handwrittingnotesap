import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Alert, Text, TouchableOpacity, PanResponder } from 'react-native';
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
const COLLABORATIVE_STORAGE_KEY = '@collaborative_strokes';

export default function CanvasScreen({ route }) {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [editingDrawing, setEditingDrawing] = useState(null);
  
  // Check if we're in collaborative mode
  const isCollaborativeMode = route?.params?.collaborativeMode || false;
  const [collaborators, setCollaborators] = useState(isCollaborativeMode ? ['User1'] : []);
  
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
          // Load from appropriate storage based on mode
          const storageKey = isCollaborativeMode ? COLLABORATIVE_STORAGE_KEY : STORAGE_KEY;
          const stored = await AsyncStorage.getItem(storageKey);
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
  }, [route?.params, isCollaborativeMode]);

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
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      const saveDelay = isCollaborativeMode ? 300 : 500; // Faster sync for collaboration
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const allStrokes = getAllStrokes();
          const strokesToSave = allStrokes.map(stroke => ({
            points: stroke,
            path: pointsToSvgPath(stroke),
            width: 3,
            color: isCollaborativeMode ? 'blue' : 'black',
            ...(isCollaborativeMode && { userId: 'currentUser' })
          }));
          
          const storageKey = isCollaborativeMode ? COLLABORATIVE_STORAGE_KEY : STORAGE_KEY;
          await AsyncStorage.setItem(storageKey, JSON.stringify(strokesToSave));
        } catch (err) {
          console.log('Error saving strokes:', err);
        }
      }, saveDelay);
    }
  }, [currentStroke, getAllStrokes().length, isCollaborativeMode]); // Depend on stroke count, not the array itself

  const pointsToSvgPath = points => {
    if (!points || points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };


  const onStrokeEnd = useCallback(() => {
    endStroke();
  }, [endStroke]);

  const handleClear = () => {
    if (isCollaborativeMode) {
      Alert.alert(
        'Clear Canvas',
        'This will clear the canvas for all collaborators. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Clear for All', 
            style: 'destructive',
            onPress: () => clear()
          }
        ]
      );
    } else {
      clear();
    }
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

      const baseData = {
        strokes: allStrokes.map(stroke => ({
          path: pointsToSvgPath(stroke),
          color: isCollaborativeMode ? 'blue' : 'black',
          width: 3,
          ...(isCollaborativeMode && { userId: 'currentUser' })
        })),
        createdAt: new Date().toISOString()
      };

      if (editingDrawing) {
        // Update existing drawing
        const updatedDrawing = {
          ...editingDrawing,
          ...baseData,
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
          title: isCollaborativeMode 
            ? `Collaborative Session ${new Date().toLocaleDateString()}`
            : `Drawing ${new Date().toLocaleDateString()}`,
          ...baseData,
          ...(isCollaborativeMode && { collaborators })
        };

        const existing = await AsyncStorage.getItem('@saved_drawings');
        const drawings = existing ? JSON.parse(existing) : [];
        drawings.push(drawingData);
        await AsyncStorage.setItem('@saved_drawings', JSON.stringify(drawings));
        
        const successMessage = isCollaborativeMode 
          ? 'Collaborative session has been saved successfully!'
          : 'Your drawing has been saved successfully!';
        Alert.alert('Saved!', successMessage);
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

  const handleCollaborate = () => {
    if (isCollaborativeMode) {
      // Exit collaborative mode
      navigation.navigate('Canvas');
    } else {
      // Enter collaborative mode
      if (editingDrawing) {
        Alert.alert(
          'Exit Edit Mode',
          'You need to exit edit mode to start collaboration. What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Discard Changes', 
              style: 'destructive',
              onPress: () => {
                resetToNormalMode();
                navigation.navigate('Canvas', { collaborativeMode: true });
              }
            },
            {
              text: 'Save & Collaborate',
              onPress: async () => {
                await handleSave();
                navigation.navigate('Canvas', { collaborativeMode: true });
              }
            }
          ]
        );
      } else {
        navigation.navigate('Canvas', { collaborativeMode: true });
      }
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

  const getStrokeColor = () => isCollaborativeMode ? 'blue' : 'black';
  const getHeaderTitle = () => {
    if (editingDrawing) return `✏️ Editing: ${editingDrawing.title}`;
    if (isCollaborativeMode) return '🤝 Collaborative';
    return '✍️ Thoughts?';
  };

  if (isLoading) return <Loader message={isCollaborativeMode ? "Loading collaborative canvas..." : "Loading canvas..."} />;

  return (
    <View style={{ ...GlobalStyles.container, paddingTop: 50, paddingBottom: 70 }}>
      {/* Debug Panel */}
      <DebugPanel />
      
      {/* Collaboration Status */}
      {isCollaborativeMode && (
        <View style={styles.collaborationStatus}>
          <Text style={styles.collaborationText}>
            🤝 {collaborators.length} collaborators
          </Text>
          {!isConnected && (
            <Text style={styles.offlineText}>📶 Offline</Text>
          )}
        </View>
      )}
      
      {/* Network Status Indicator */}
      {!isConnected && !isCollaborativeMode && (
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
          {getHeaderTitle()}
        </Text>
        
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={handleCollaborate} style={[GlobalStyles.headerButton, { marginRight: 5 }]}>
            <Text style={GlobalStyles.headerButtonText}>
              {isCollaborativeMode ? '👤' : '🤝'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNotes} style={GlobalStyles.headerButton}>
            <Text style={GlobalStyles.headerButtonText}>Notes</Text>
          </TouchableOpacity>
        </View>
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
              color={getStrokeColor()}
              style="stroke"
              strokeWidth={3}
            />
          ))}

          {currentStroke.length > 0 && (
            <Path
              path={pointsToSvgPath(currentStroke)}
              color={getStrokeColor()}
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
  collaborationStatus: {
    position: 'absolute',
    top: 200,
    left: 10,
    backgroundColor: 'rgba(0, 123, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaborationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
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

