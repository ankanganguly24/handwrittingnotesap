import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useNetworkStatus from '../hooks/useNetworkStatus';
import usePerformanceStats from '../hooks/usePerformanceStats';

export default function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const { isConnected, networkType } = useNetworkStatus();
  const { fps, memoryUsage, renderTime } = usePerformanceStats();

  const getNetworkStatusColor = () => {
    return isConnected ? '#28a745' : '#dc3545';
  };

  const getFpsColor = () => {
    if (fps >= 55) return '#28a745';
    if (fps >= 30) return '#ffc107';
    return '#dc3545';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.toggleButton}
        onPress={() => setIsVisible(!isVisible)}
      >
        <Text style={styles.toggleButtonText}>
          {isVisible ? '🔽' : '🔼'} Debug
        </Text>
      </TouchableOpacity>
      
      {isVisible && (
        <View style={styles.panel}>
          <Text style={styles.title}>System Stats</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Network:</Text>
            <View style={[styles.indicator, { backgroundColor: getNetworkStatusColor() }]} />
            <Text style={styles.value}>
              {isConnected ? `Online (${networkType})` : 'Offline'}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>FPS:</Text>
            <Text style={[styles.value, { color: getFpsColor() }]}>
              {fps}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Memory:</Text>
            <Text style={styles.value}>{memoryUsage} MB</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Render:</Text>
            <Text style={styles.value}>{renderTime} ms</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 10,
    zIndex: 1000,
  },
  toggleButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 5,
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 10,
    borderRadius: 8,
    minWidth: 150,
  },
  title: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: '#ccc',
    fontSize: 10,
    width: 50,
  },
  value: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    flex: 1,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
});
