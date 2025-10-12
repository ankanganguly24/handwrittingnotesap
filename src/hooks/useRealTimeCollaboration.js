import { useState, useCallback } from 'react';

export const useRealTimeCollaboration = (roomId, enabled = false) => {
  const [localStrokes, setLocalStrokes] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [collaborationStats, setCollaborationStats] = useState({
    totalStrokes: 0,
    localStrokes: 0,
    remoteStrokes: 0
  });

  const currentUserId = 'local_user';
  
  const addStroke = useCallback(() => {
    // Empty for now
  }, []);

  const clearCanvas = useCallback(() => {
    // Empty for now
  }, []);

  const undoLastStroke = useCallback(() => {
    // Empty for now
  }, []);

  return {
    localStrokes,
    connectedUsers,
    connectionStatus,
    collaborationStats,
    currentUserId,
    addStroke,
    clearCanvas,
    undoLastStroke,
    isConnected: false,
    roomId
  };
};
