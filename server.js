const { WebSocketServer } = require('ws');
const Y = require('yjs');

const wss = new WebSocketServer({
  port: process.env.PORT || 1234,
  perMessageDeflate: false,
  clientTracking: true,
});

const docs = new Map();
const roomClients = new Map(); // Track clients per room

wss.on('connection', (ws, req) => {
  const roomId = req.url.slice(1) || 'default-room';
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`New client ${clientId} connected to room ${roomId} from:`, req.socket.remoteAddress);
  
  // Initialize room if it doesn't exist
  if (!docs.has(roomId)) {
    docs.set(roomId, new Y.Doc());
    roomClients.set(roomId, new Set());
  }
  
  const doc = docs.get(roomId);
  const clients = roomClients.get(roomId);
  clients.add(ws);
  
  // Mark client with room info
  ws.roomId = roomId;
  ws.clientId = clientId;
  ws.isAlive = true;
  ws.lastActivity = Date.now();

  // Send initial state only if document has meaningful content
  const initialState = Y.encodeStateAsUpdate(doc);
  if (initialState.length > 2) {
    try {
      ws.send(JSON.stringify(Array.from(initialState)));
      console.log(`Sent initial state to ${clientId}, size: ${initialState.length}`);
    } catch (error) {
      console.error(`Error sending initial state to ${clientId}:`, error);
    }
  }

  // Send room info to client
  ws.send(JSON.stringify({
    type: 'room-info',
    roomId: roomId,
    clientCount: clients.size,
    clientId: clientId
  }));

  ws.on('message', (message) => {
    try {
      const messageStr = message.toString();
      
      // Handle special message types
      try {
        const parsed = JSON.parse(messageStr);
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }
      } catch (e) {
        // Not a special message, continue with normal processing
      }
      
      // Ignore empty or minimal updates
      if (!messageStr || messageStr === '[]' || messageStr === '[0,0]' || messageStr.length < 5) {
        return;
      }

      const update = new Uint8Array(JSON.parse(messageStr));
      
      // Only process meaningful updates
      if (update.length <= 2) {
        return;
      }

      console.log(`Processing update from ${clientId}, size: ${update.length}`);
      
      // Apply update to document
      Y.applyUpdate(doc, update);
      
      // Broadcast to other clients in the same room
      let broadcastCount = 0;
      clients.forEach((client) => {
        if (client !== ws && client.readyState === client.OPEN) {
          try {
            client.send(messageStr);
            broadcastCount++;
          } catch (error) {
            console.error(`Error broadcasting to client:`, error);
            clients.delete(client);
          }
        }
      });
      
      if (broadcastCount > 0) {
        console.log(`Broadcasted update to ${broadcastCount} clients in room ${roomId}`);
      }
      
      ws.lastActivity = Date.now();
      
    } catch (error) {
      console.error(`Error processing message from ${clientId}:`, error);
    }
  });

  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastActivity = Date.now();
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });

  ws.on('close', (code, reason) => {
    console.log(`Client ${clientId} disconnected from room ${roomId}:`, { 
      code, 
      reason: reason.toString(),
      duration: Date.now() - ws.lastActivity 
    });
    
    // Clean up client from room
    if (clients) {
      clients.delete(ws);
      
      // Notify remaining clients about user count change
      clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          try {
            client.send(JSON.stringify({
              type: 'room-info',
              roomId: roomId,
              clientCount: clients.size
            }));
          } catch (error) {
            console.error('Error sending room info:', error);
          }
        }
      });
      
      // Clean up empty rooms after some time
      if (clients.size === 0) {
        setTimeout(() => {
          if (clients.size === 0) {
            console.log(`Cleaning up empty room: ${roomId}`);
            docs.delete(roomId);
            roomClients.delete(roomId);
          }
        }, 60000);
      }
    }
  });
});

// Heartbeat mechanism
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`Terminating inactive client ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    
    // Check for stale connections (no activity for 2 minutes)
    if (Date.now() - ws.lastActivity > 120000) {
      console.log(`Terminating stale client ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

wss.on('close', () => {
  clearInterval(heartbeat);
  console.log('WebSocket server closed');
});

// Log server stats periodically
setInterval(() => {
  const totalClients = wss.clients.size;
  const totalRooms = docs.size;
  console.log(`Server stats - Clients: ${totalClients}, Rooms: ${totalRooms}`);
}, 60000);

console.log('WebSocket server running on ws://192.168.29.215:1234');
console.log('Waiting for connections...');