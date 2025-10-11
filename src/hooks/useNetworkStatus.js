import { useState, useEffect } from 'react';

export default function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [networkType, setNetworkType] = useState('unknown');

  useEffect(() => {
    // Check if we're in a web environment or native
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      // Web environment
      setIsConnected(navigator.onLine);
      
      const handleOnline = () => setIsConnected(true);
      const handleOffline = () => setIsConnected(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // For React Native, we'll simulate network status
      // In a real app, you'd use @react-native-community/netinfo
      const checkNetwork = () => {
        const isOnline = Math.random() > 0.1; // 90% online simulation
        setIsConnected(isOnline);
        setNetworkType(isOnline ? 'wifi' : 'none');
      };
      
      checkNetwork();
      const interval = setInterval(checkNetwork, 5000);
      
      return () => clearInterval(interval);
    }
  }, []);

  return { isConnected, networkType };
}
