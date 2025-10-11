import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DrawTab from '../components/DrawTab';
import NotesTab from '../components/NotesTab';

const DRAWINGS_KEY = '@saved_drawings';
const NOTES_KEY = '@saved_notes';

export default function SaveScreen() {
  const [activeTab, setActiveTab] = useState('draw');
  const [drawings, setDrawings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedDrawings = await AsyncStorage.getItem(DRAWINGS_KEY);
      const savedNotes = await AsyncStorage.getItem(NOTES_KEY);
      
      if (savedDrawings) setDrawings(JSON.parse(savedDrawings));
      if (savedNotes) setNotes(JSON.parse(savedNotes));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveDrawings = async (updatedDrawings) => {
    try {
      await AsyncStorage.setItem(DRAWINGS_KEY, JSON.stringify(updatedDrawings));
      setDrawings(updatedDrawings);
    } catch (error) {
      console.error('Error saving drawings:', error);
    }
  };

  const saveNotes = async (updatedNotes) => {
    try {
      await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const deleteItem = (id, type) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (type === 'draw') {
              const updated = drawings.filter(item => item.id !== id);
              saveDrawings(updated);
            } else {
              const updated = notes.filter(item => item.id !== id);
              saveNotes(updated);
            }
          }
        }
      ]
    );
  };

  const editItem = (item, type) => {
    setEditingItem({ ...item, type });
    setInputText(item.title);
    setIsModalVisible(true);
  };

  const saveEdit = () => {
    if (!inputText.trim()) return;

    if (editingItem.type === 'draw') {
      const updated = drawings.map(item =>
        item.id === editingItem.id ? { ...item, title: inputText.trim() } : item
      );
      saveDrawings(updated);
    } else {
      const updated = notes.map(item =>
        item.id === editingItem.id ? { ...item, title: inputText.trim() } : item
      );
      saveNotes(updated);
    }

    setIsModalVisible(false);
    setEditingItem(null);
    setInputText('');
  };

  const createNote = () => {
    setEditingItem({ type: 'note', id: null });
    setInputText('');
    setIsModalVisible(true);
  };

  const saveNewNote = () => {
    if (!inputText.trim()) return;

    const newNote = {
      id: Date.now().toString(),
      title: inputText.trim(),
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...notes, newNote];
    saveNotes(updated);
    setIsModalVisible(false);
    setInputText('');
    setEditingItem(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'draw' && styles.activeTab]}
          onPress={() => setActiveTab('draw')}
        >
          <Text style={[styles.tabText, activeTab === 'draw' && styles.activeTabText]}>
            Draw ({drawings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notes' && styles.activeTab]}
          onPress={() => setActiveTab('notes')}
        >
          <Text style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>
            Notes ({notes.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'draw' ? (
          <DrawTab
            drawings={drawings}
            onDelete={(id) => deleteItem(id, 'draw')}
            onEdit={(item) => editItem(item, 'draw')}
          />
        ) : (
          <NotesTab
            notes={notes}
            onDelete={(id) => deleteItem(id, 'notes')}
            onEdit={(item) => editItem(item, 'notes')}
            onCreate={createNote}
          />
        )}
      </View>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem?.id ? 'Edit Title' : 'Create Note'}
            </Text>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Enter title..."
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsModalVisible(false);
                  setEditingItem(null);
                  setInputText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={editingItem?.id ? saveEdit : saveNewNote}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  tabText: {
    fontSize: 16,
    color: '#6c757d',
  },
  activeTabText: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 10,
    marginRight: 10,
    backgroundColor: '#6c757d',
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
