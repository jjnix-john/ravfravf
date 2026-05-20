import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import fs from "fs";
import path from "path";

const PORT = 3001;
const DB_FILE = path.resolve("./db.json");

const app = express();
app.use(cors());
app.use(express.json());

// Initialize DB file if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({
      messages: [
        { id: 1, sender: "System", text: "Welcome to your shared secure space. Messages sent here are synced in real-time. 🌸", timestamp: "00:00" },
        { id: 2, sender: "Our Love Journal", text: "I love you more than words can say. Happy 34th month, my love! 💖", timestamp: "07:21" }
      ]
    }, null, 2)
  );
}

// Helper to read DB
function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return { messages: [] };
  }
}

// Helper to write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing to DB file:", err);
  }
}

// REST Endpoints
app.get("/api/messages", (req, res) => {
  const db = readDb();
  res.json(db.messages);
});

app.post("/api/messages", (req, res) => {
  const { sender, text, timestamp } = req.body;
  if (!sender || !text) {
    return res.status(400).json({ error: "Sender and text are required" });
  }

  const db = readDb();
  const newMessage = {
    id: Date.now(),
    sender,
    text,
    timestamp: timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  db.messages.push(newMessage);
  writeDb(db);

  res.status(201).json(newMessage);
});

app.delete("/api/messages", (req, res) => {
  const reset = [
    { id: 1, sender: "System", text: "Chat history cleared with love.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ];
  writeDb({ messages: reset });
  res.json({ success: true, messages: reset });
});

// Create HTTP server
const httpServer = createServer(app);

// Mount WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// In-memory active sockets registration
// Map socket instance to metadata
const activeClients = new Map();

function broadcast(data) {
  const messageString = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
}

function getOnlineUsersList() {
  const list = [];
  const processed = new Set();
  for (const client of activeClients.values()) {
    const key = `${client.nickname}-${client.sessionId}`;
    if (!processed.has(key)) {
      list.push({ nickname: client.nickname, sessionId: client.sessionId });
      processed.add(key);
    }
  }
  return list;
}

wss.on("connection", (ws) => {
  console.log("New WebSocket connection established.");

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      const { type, payload } = parsed;

      if (type === "IDENTIFY") {
        // Register client presence
        activeClients.set(ws, {
          nickname: payload.nickname,
          sessionId: payload.sessionId
        });
        console.log(`User Identified: ${payload.nickname} (Session: ${payload.sessionId})`);
        
        // Broadcast updated presence list
        broadcast({
          type: "PRESENCE_UPDATE",
          payload: { onlineUsers: getOnlineUsersList() }
        });
      } else if (type === "CHAT_MESSAGE") {
        // Append message to db.json
        const db = readDb();
        const msg = payload.message;
        db.messages.push(msg);
        writeDb(db);

        // Broadcast message to all connected clients
        broadcast({
          type: "CHAT_MESSAGE",
          payload: { message: msg }
        });
      }
    } catch (err) {
      console.error("Error handling WS message:", err);
    }
  });

  ws.on("close", () => {
    const clientMeta = activeClients.get(ws);
    if (clientMeta) {
      console.log(`User Disconnected: ${clientMeta.nickname}`);
      activeClients.delete(ws);
      
      // Broadcast updated presence list
      broadcast({
        type: "PRESENCE_UPDATE",
        payload: { onlineUsers: getOnlineUsersList() }
      });
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Secure Space Backend Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server active on ws://localhost:${PORT}`);
});
