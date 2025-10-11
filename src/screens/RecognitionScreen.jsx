import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RecognitionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recognition Screen</Text>
      <Text style={styles.subtitle}>Text recognition functionality will be implemented here</Text>
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
