const { WebSocketServer } = require('ws');
const Y = require('yjs');

const wss = new WebSocketServer({
  port: process.env.PORT || 1234,
  perMessageDeflate: false,
  clientTracking: true,
});

const docs = new Map();
const roomClients = new Map();

wss.on('connection', (ws, req) => {
  const roomId = req.url.slice(1) || 'default-room';
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (!docs.has(roomId)) {
    docs.set(roomId, new Y.Doc());
    roomClients.set(roomId, new Set());
  }
  
  const doc = docs.get(roomId);
  const clients = roomClients.get(roomId);
  clients.add(ws);
  
  ws.roomId = roomId;
  ws.clientId = clientId;
  ws.isAlive = true;
  ws.lastActivity = Date.now();

  const initialState = Y.encodeStateAsUpdate(doc);
  if (initialState.length > 2) {
    try {
      ws.send(JSON.stringify(Array.from(initialState)));
    } catch (error) {}
  }

  ws.send(JSON.stringify({
    type: 'room-info',
    roomId: roomId,
    clientCount: clients.size,
    clientId: clientId
  }));

  ws.on('message', (message) => {
    try {
      const messageStr = message.toString();
      console.log(`[Server] Received message: ${messageStr}`);

      const update = new Uint8Array(JSON.parse(messageStr));
      Y.applyUpdate(doc, update);

      // Log the structure of the Yjs document
      console.log('[Server] Current Y.Doc structure:', {
        strokes: doc.getArray('strokes').toArray(),
      });

      // Broadcast the update to all clients
      clients.forEach((client) => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(messageStr);
          console.log(`[Server] Broadcasted update to client ${client.clientId}`);
        }
      });

      ws.lastActivity = Date.now();
    } catch (error) {
      console.error(`[Server] Error processing message: ${error.message}`);
    }
  });

  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastActivity = Date.now();
  });

  ws.on('error', (error) => {});

  ws.on('close', (code, reason) => {
    if (clients) {
      clients.delete(ws);
      
      clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          try {
            client.send(JSON.stringify({
              type: 'room-info',
              roomId: roomId,
              clientCount: clients.size
            }));
          } catch (error) {}
        }
      });
      
      if (clients.size === 0) {
        setTimeout(() => {
          if (clients.size === 0) {
            docs.delete(roomId);
            roomClients.delete(roomId);
          }
        }, 60000);
      }
    }
  });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    
    if (Date.now() - ws.lastActivity > 120000) {
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('error', (error) => {});

wss.on('close', () => {
  clearInterval(heartbeat);
});

setInterval(() => {
  const totalClients = wss.clients.size;
  const totalRooms = docs.size;
}, 60000);