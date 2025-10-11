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

const COLLABORATIVE_STORAGE_KEY = '@collaborative_strokes';

export default function CollaborativeCanvas({ route }) {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [collaborators, setCollaborators] = useState(['User1']);
  
  const [currentStroke, addPoint, endStroke, undo, redo, clear, getAllStrokes, loadStrokes] = useCanvasEngine();

  const { isConnected } = useNetworkStatus();
  const canvasRef = useRef(null);
  const [canvasLayout, setCanvasLayout] = useState(null);
  const canvasLayoutRef = useRef(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = locationX || 0;
        const y = locationY || 0;
        addPoint({ x, y });
        // TODO: Broadcast to collaborators
      },
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = locationX || 0;
        const y = locationY || 0;
        addPoint({ x, y });
        // TODO: Broadcast to collaborators
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
    const loadCollaborativeStrokes = async () => {
      try {
        const stored = await AsyncStorage.getItem(COLLABORATIVE_STORAGE_KEY);
        if (stored) {
          const parsedStrokes = JSON.parse(stored);
          if (parsedStrokes.length > 0) {
            loadStrokes(parsedStrokes);
          }
        }
      } catch (err) {
        console.log('Error loading collaborative strokes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadCollaborativeStrokes();
  }, []);

  // Auto-save collaborative strokes
  const saveTimeoutRef = useRef(null);
  const lastStrokeCountRef = useRef(0);

  useEffect(() => {
    const currentStrokeCount = getAllStrokes().length;
    
    if (currentStrokeCount !== lastStrokeCountRef.current && currentStrokeCount > 0) {
      lastStrokeCountRef.current = currentStrokeCount;
      
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
            color: 'blue', // Different color for collaborative mode
            userId: 'currentUser'
          }));
          await AsyncStorage.setItem(COLLABORATIVE_STORAGE_KEY, JSON.stringify(strokesToSave));
          // TODO: Sync with collaboration server
        } catch (err) {
          console.log('Error saving collaborative strokes:', err);
        }
      }, 300); // Faster sync for collaboration
    }
  }, [currentStroke, getAllStrokes().length]);

  const pointsToSvgPath = points => {
    if (!points || points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const onStrokeEnd = useCallback(() => {
    endStroke();
    // TODO: Broadcast stroke completion to collaborators
  }, [endStroke]);

  const handleClear = () => {
    Alert.alert(
      'Clear Canvas',
      'This will clear the canvas for all collaborators. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear for All', 
          style: 'destructive',
          onPress: () => {
            clear();
            // TODO: Broadcast clear to all collaborators
          }
        }
      ]
    );
  };

  const handleUndo = () => {
    undo();
    // TODO: Broadcast undo to collaborators
  };

  const handleRedo = () => {
    redo();
    // TODO: Broadcast redo to collaborators
  };

  const handleSave = async () => {
    if (!isConnected) {
      Alert.alert(
        'Offline Mode', 
        'You are currently offline. Collaborative session will sync when connection is restored.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const allStrokes = getAllStrokes();
      if (allStrokes.length === 0) {
        Alert.alert('Nothing to save', 'Please draw something first!');
        return;
      }

      const collaborativeData = {
        id: Date.now().toString(),
        title: `Collaborative Session ${new Date().toLocaleDateString()}`,
        strokes: allStrokes.map(stroke => ({
          path: pointsToSvgPath(stroke),
          color: 'blue',
          width: 3,
          userId: 'currentUser'
        })),
        collaborators: collaborators,
        createdAt: new Date().toISOString()
      };

      const existing = await AsyncStorage.getItem('@saved_drawings');
      const drawings = existing ? JSON.parse(existing) : [];
      drawings.push(collaborativeData);
      await AsyncStorage.setItem('@saved_drawings', JSON.stringify(drawings));
      
      Alert.alert('Saved!', 'Collaborative session has been saved successfully!');
      navigation.navigate('Save');
    } catch (error) {
      console.error('Error saving collaborative session:', error);
      Alert.alert('Error', 'Failed to save collaborative session');
    }
  };

  const handleBackToCanvas = () => {
    navigation.navigate('Canvas');
  };

  if (isLoading) return <Loader message="Loading collaborative canvas..." />;

  return (
    <View style={{ ...GlobalStyles.container, paddingTop: 50, paddingBottom: 70 }}>
      {/* Debug Panel */}
      <DebugPanel />
      
      {/* Collaboration Status */}
      <View style={styles.collaborationStatus}>
        <Text style={styles.collaborationText}>
          🤝 {collaborators.length} collaborators
        </Text>
        {!isConnected && (
          <Text style={styles.offlineText}>📶 Offline</Text>
        )}
      </View>

      <View style={GlobalStyles.header}>
        <TouchableOpacity onPress={handleBackToCanvas} style={GlobalStyles.headerButton}>
          <Text style={GlobalStyles.headerButtonText}>← Canvas</Text>
        </TouchableOpacity>
        
        <Text style={[GlobalStyles.headerTitle, { flex: 1, textAlign: 'center' }]}>
          🤝 collab
        </Text>
        
        <TouchableOpacity onPress={() => navigation.navigate('Recognition')} style={GlobalStyles.headerButton}>
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
              color="blue"
              style="stroke"
              strokeWidth={3}
            />
          ))}

          {currentStroke.length > 0 && (
            <Path
              path={pointsToSvgPath(currentStroke)}
              color="blue"
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
  offlineText: {
    color: '#ffeb3b',
    fontSize: 10,
    fontWeight: 'bold',
  },
};
