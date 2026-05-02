const WebSocket = require("ws");
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

wss.on("connection", (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ws.id = uuidv4();
  console.log(`Client connecté - ID: ${ws.id} - IP: ${ip}`);
  
  ws.on("message", (msg) => {
    ws.send("Reçu: " + msg);
  });
});
