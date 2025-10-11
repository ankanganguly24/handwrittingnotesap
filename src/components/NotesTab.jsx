import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

export default function NotesTab({ notes, onDelete, onEdit, onCreate }) {
  const renderNote = ({ item }) => (
    <View style={styles.noteItem}>
      <View style={styles.noteHeader}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        <Text style={styles.noteDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      
      {item.content && (
        <Text style={styles.noteContent} numberOfLines={3}>
          {item.content}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => onEdit(item)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
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

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.createButton} onPress={onCreate}>
        <Text style={styles.createButtonText}>+ Create New Note</Text>
      </TouchableOpacity>

      {notes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notes saved yet</Text>
          <Text style={styles.emptySubtext}>Create your first note!</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  createButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  noteItem: {
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
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  noteDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  noteContent: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 10,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    padding: 8,
    marginRight: 5,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignItems: 'center',
  },
  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    padding: 8,
    marginLeft: 5,
    backgroundColor: '#dc3545',
    borderRadius: 5,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
