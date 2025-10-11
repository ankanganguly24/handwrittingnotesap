import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { useNavigation } from '@react-navigation/native';

export default function DrawTab({ drawings, onDelete, onEdit }) {
  const navigation = useNavigation();

  const handleEditDrawing = (item) => {
    // Navigate back to canvas with the drawing data for editing
    navigation.navigate('Canvas', { 
      editMode: true, 
      drawingData: item 
    });
  };

  const renderDrawing = ({ item }) => (
    <View style={styles.drawingItem}>
      <View style={styles.drawingHeader}>
        <Text style={styles.drawingTitle}>{item.title}</Text>
        <Text style={styles.drawingDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      
      <View style={styles.canvasContainer}>
        <Canvas style={styles.canvas}>
          {item.strokes?.map((stroke, idx) => (
            <Path
              key={idx}
              path={stroke.path}
              color={stroke.color || 'black'}
              style="stroke"
              strokeWidth={stroke.width || 2}
            />
          ))}
        </Canvas>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditDrawing(item)}
        >
          <Text style={styles.editButtonText}>Edit Canvas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.renameButton}
          onPress={() => onEdit(item)}
        >
          <Text style={styles.renameButtonText}>Rename</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (drawings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No drawings saved yet</Text>
        <Text style={styles.emptySubtext}>Draw something on the canvas and save it!</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={drawings}
      renderItem={renderDrawing}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
  },
  drawingItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  drawingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  drawingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  drawingDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  canvasContainer: {
    height: 150,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    padding: 8,
    marginRight: 3,
    backgroundColor: '#28a745',
    borderRadius: 5,
    alignItems: 'center',
  },
  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  renameButton: {
    flex: 1,
    padding: 8,
    marginHorizontal: 3,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignItems: 'center',
  },
  renameButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteButton: {
    flex: 1,
    padding: 8,
    marginLeft: 3,
    backgroundColor: '#dc3545',
    borderRadius: 5,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6c757d',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});
