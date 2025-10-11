import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CollaborationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collaboration Screen</Text>
      <Text style={styles.subtitle}>Collaboration features will be implemented here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
