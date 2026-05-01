const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

wss.on("connection", (ws) => {
  console.log("Client connecté");

  ws.on("message", (msg) => {
    console.log("Message:", msg);
    ws.send("Reçu: " + msg);
  });
});
