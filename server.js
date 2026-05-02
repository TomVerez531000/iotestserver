const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

wss.on("connection", (ws) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ws.id = uuidv4();
  console.log(`Client connecté - ID: ${ws.id} - IP: ${ip}`);
  
  ws.on("message", (msg) => {
    ws.send("Reçu: " + msg);
  });
});
