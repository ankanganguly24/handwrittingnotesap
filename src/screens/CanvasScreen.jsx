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
import { useCollaborationEngine } from '../hooks/useCollaborationEngine';
import { useRealTimeCollaboration } from '../hooks/useRealTimeCollaboration';

const STORAGE_KEY = '@handwriting_strokes';
const COLLABORATIVE_STORAGE_KEY = '@collaborative_strokes';

export default function CanvasScreen({ route }) {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [editingDrawing, setEditingDrawing] = useState(null);
  
  const isCollaborativeMode = route?.params?.collaborativeMode || false;
  const roomIdParam = route?.params?.roomId;
  
  const roomId = isCollaborativeMode ? 'collab_room_main' : null;
  
  const [currentStroke, addPoint, endStroke, undo, redo, clear, getAllStrokes, loadStrokes] = useCanvasEngine();

  const collaborationEngine = useCollaborationEngine(
    isCollaborativeMode && roomId ? `collab_${roomId}` : null,
    isCollaborativeMode
  );

  const realtimeCollab = useRealTimeCollaboration(
    roomId,
    isCollaborativeMode
  );

  const { isConnected } = useNetworkStatus();
  const canvasRef = useRef(null);
  const [canvasLayout, setCanvasLayout] = useState(null);
  const canvasLayoutRef = useRef(null);
  const [touchDebug, setTouchDebug] = useState('No touch detected');
  const lastSyncedStrokeCount = useRef(0);

  useEffect(() => {
    if (!isCollaborativeMode || !roomId) return;

    const collabStrokes = realtimeCollab.isConnected 
      ? realtimeCollab.localStrokes 
      : collaborationEngine.localStrokes;

    console.log('[CanvasScreen] Collaborative strokes updated:', collabStrokes);

    // For collaborative mode, collabStrokes is [{ points: [...] }, ...]
    // We want to pass [ [...], [...], ... ] to loadStrokes
    if (Array.isArray(collabStrokes) && collabStrokes.length > 0) {
      const strokesAsPoints = collabStrokes.map(stroke => stroke.points || []);
      console.log('[CanvasScreen] Loading strokes into canvas:', strokesAsPoints);
      loadStrokes(strokesAsPoints);
      lastSyncedStrokeCount.current = collabStrokes.length;
    } else {
      loadStrokes([]);
      lastSyncedStrokeCount.current = 0;
    }
  }, [
    realtimeCollab.localStrokes, 
    collaborationEngine.localStrokes, 
    isCollaborativeMode, 
    roomId,
    realtimeCollab.isConnected,
    realtimeCollab.connectedUsers.length
  ]);

  useEffect(() => {
    const loadStrokesFromStorage = async () => {
      try {
        if (route?.params?.editMode && route?.params?.drawingData) {
          const drawingData = route.params.drawingData;
          setEditingDrawing(drawingData);
          
          const strokesAsPoints = drawingData.strokes.map(stroke => {
            return svgPathToPoints(stroke.path);
          });
          
          if (strokesAsPoints.length > 0) {
            loadStrokes(strokesAsPoints);
          }
        } else {
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
      } finally {
        setIsLoading(false);
      }
    };
    loadStrokesFromStorage();
  }, [route?.params, isCollaborativeMode]);

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

  const saveTimeoutRef = useRef(null);
  const lastStrokeCountRef = useRef(0);

  useEffect(() => {
    const currentStrokeCount = getAllStrokes().length;
    
    if (currentStrokeCount !== lastStrokeCountRef.current && currentStrokeCount > 0) {
      lastStrokeCountRef.current = currentStrokeCount;
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      const saveDelay = isCollaborativeMode ? 300 : 500; 
      
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
        } catch (err) {}
      }, saveDelay);
    }
  }, [currentStroke, getAllStrokes().length, isCollaborativeMode]); 

  const pointsToSvgPath = points => {
    // Add even more defensive checks
    if (!points || !Array.isArray(points) || points.length === 0) {
      console.log('[CanvasScreen] pointsToSvgPath: Invalid input:', points);
      return '';
    }
    
    try {
      const validPoints = points.filter(p => {
        if (!p || typeof p !== 'object') {
          console.log('[CanvasScreen] pointsToSvgPath: Invalid point (not object):', p);
          return false;
        }
        if (typeof p.x !== 'number' || typeof p.y !== 'number') {
          console.log('[CanvasScreen] pointsToSvgPath: Invalid point (not numbers):', p);
          return false;
        }
        if (isNaN(p.x) || isNaN(p.y)) {
          console.log('[CanvasScreen] pointsToSvgPath: Invalid point (NaN):', p);
          return false;
        }
        return true;
      });
      
      if (validPoints.length === 0) {
        console.log('[CanvasScreen] pointsToSvgPath: No valid points after filtering');
        return '';
      }
      
      const path = validPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return path;
    } catch (error) {
      console.error('[CanvasScreen] Error converting points to SVG path:', error);
      console.error('[CanvasScreen] Points that caused error:', points);
      return '';
    }
  };

  const onStrokeEnd = useCallback(() => {
    endStroke();
    
    if (isCollaborativeMode && currentStroke.length > 0 && roomId) {
      const strokeData = {
        points: [...currentStroke],
        path: pointsToSvgPath(currentStroke),
        color: 'blue',
        width: 3,
        userId: realtimeCollab.currentUserId || 'unknown_user',
        timestamp: Date.now(),
      };
      
      console.log('[CanvasScreen] Stroke ended:', currentStroke);
      
      try {
        if (realtimeCollab.isConnected) {
          realtimeCollab.addStroke(strokeData);
        } else {
          collaborationEngine.addStroke(strokeData);
        }
      } catch (error) {}
    }
  }, [endStroke, currentStroke, isCollaborativeMode, roomId, realtimeCollab]);

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
            onPress: () => {
              clear();
              if (realtimeCollab.isConnected) {
                realtimeCollab.clearCanvas();
              } else {
                collaborationEngine.clearCanvas();
              }
            }
          }
        ]
      );
    } else {
      clear();
    }
  };

  const handleUndo = () => {
    undo();
    if (isCollaborativeMode) {
      if (realtimeCollab.isConnected) {
        realtimeCollab.undoLastStroke();
      } else {
        collaborationEngine.undoLastStroke();
      }
    }
  };

  const handleRedo = () => redo();
  const handleSync = async () => {
    if (!isConnected) {
      Alert.alert(
        'Offline Mode', 
        'You are currently offline. Drawing will be synced when connection is restored.',
        [{ text: 'OK' }]
      );
      return;
    }
    const strokesToSync = getAllStrokes();
    if (!strokesToSync || strokesToSync.length === 0) {
      Alert.alert('Nothing to sync', 'Please draw something first!');
      return;
    }
    if (isCollaborativeMode && realtimeCollab.isConnected) {
      realtimeCollab.syncStrokesToYjs(strokesToSync);
  
    }
  };

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
      Alert.alert('Error', 'Failed to save drawing');
    }
  };

  const handleNotes = () => {
    if (editingDrawing) {
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
      navigation.navigate('Canvas');
    } else {
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

  const resetToNormalMode = () => {
    setEditingDrawing(null);
    clear();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Canvas' }]
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = locationX || 0;
        const y = locationY || 0;
        setTouchDebug(`Touch at ${Math.round(x)}, ${Math.round(y)}`);
        addPoint({ x, y });
        // Collaborative: start stroke
        if (isCollaborativeMode && roomId && currentStroke.length === 0) {
          const strokeData = {
            points: [{ x, y }],
            path: '',
            color: 'blue',
            width: 3,
            userId: realtimeCollab.currentUserId || 'unknown_user',
            timestamp: Date.now(),
          };
          if (realtimeCollab.isConnected) {
            realtimeCollab.addStroke(strokeData);
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = locationX || 0;
        const y = locationY || 0;
        addPoint({ x, y });
        // Collaborative: send point
        if (isCollaborativeMode && roomId) {
          if (realtimeCollab.isConnected) {
            realtimeCollab.addPointToStroke({ x, y });
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        onStrokeEnd();
      },
      onPanResponderTerminate: (evt, gestureState) => {
        onStrokeEnd();
      },
    })
  ).current;

  const getStrokeColor = () => isCollaborativeMode ? 'blue' : 'black';
  const getHeaderTitle = () => {
    if (editingDrawing) return `✏️ Editing: ${editingDrawing.title}`;
    if (isCollaborativeMode) {
      const roomDisplay = roomId ? roomId.substring(0, 15) : 'No Room';
      return `🤝 ${roomDisplay}`;
    }
    return '✍️ Thoughts?';
  };

  if (isLoading) return <Loader message={isCollaborativeMode ? "Loading collaborative canvas..." : "Loading canvas..."} />;

  return (
    <View style={{ ...GlobalStyles.container, paddingTop: 50, paddingBottom: 70 }}>
      <DebugPanel />
      
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
          {(() => {
            try {
              const allStrokes = getAllStrokes();
              console.log('[CanvasScreen] Rendering strokes count:', allStrokes.length);
              
              return allStrokes
                .filter((stroke, idx) => {
                  if (!Array.isArray(stroke)) {
                    console.log(`[CanvasScreen] Invalid stroke at index ${idx}:`, stroke);
                    return false;
                  }
                  if (stroke.length === 0) {
                    console.log(`[CanvasScreen] Empty stroke at index ${idx}`);
                    return false;
                  }
                  return true;
                })
                .map((stroke, idx) => {
                  try {
                    const path = pointsToSvgPath(stroke);
                    if (!path) {
                      console.log(`[CanvasScreen] No path generated for stroke ${idx}`);
                      return null;
                    }
                    
                    return (
                      <Path
                        key={`stroke-${idx}`}
                        path={path}
                        color={getStrokeColor()}
                        style="stroke"
                        strokeWidth={3}
                      />
                    );
                  } catch (error) {
                    console.error(`[CanvasScreen] Error rendering stroke ${idx}:`, error);
                    console.error(`[CanvasScreen] Stroke data:`, stroke);
                    return null;
                  }
                })
                .filter(Boolean);
            } catch (error) {
              console.error('[CanvasScreen] Error in stroke rendering loop:', error);
              return [];
            }
          })()}

          {(() => {
            try {
              if (currentStroke.length > 0) {
                const path = pointsToSvgPath(currentStroke);
                if (path) {
                  return (
                    <Path
                      path={path}
                      color={getStrokeColor()}
                      style="stroke"
                      strokeWidth={3}
                    />
                  );
                }
              }
              return null;
            } catch (error) {
              console.error('[CanvasScreen] Error rendering current stroke:', error);
              return null;
            }
          })()}
        </Canvas>
        
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

      {isCollaborativeMode && (
        <View style={styles.roomInfo}>
          <Text style={styles.roomInfoText}>Room: {roomId || 'No Room ID'}</Text>
          <Text style={styles.roomInfoText}>
            Users: {realtimeCollab.connectedUsers?.map(u => u.id?.substring(5, 10)).join(', ') || 'Only you'}
          </Text>
          <Text style={styles.roomInfoText}>
            Status: {realtimeCollab.connectionStatus} | Strokes: {getAllStrokes().length}
          </Text>
        </View>
      )}

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
          save: isCollaborativeMode ? handleSync : handleSave,
          isCollaborativeMode: isCollaborativeMode,
        }}
      />
    </View>
  );
}

const styles = {
  roomInfo: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  roomInfoText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'monospace',
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