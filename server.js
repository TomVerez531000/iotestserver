const WebSocket = require("ws");
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

function send_data(ws, data) {
  const text = JSON.stringify(data);
  ws.send(text);
}

players = {}
function player_join(ws, data) {
  const nickname = data.nickname
  if (nickname == null || nickname == "" || nickname.length > 20) {
    var message = {};
    message.type = "join-response";
    message.success = false;
    send_data(ws, message);
    return
  }

  players[ws.id] = {};
  var message = {};
  message.type = "join-response";
  message.success = true;
  send_data(ws, message);
}

function update_direction(ws, data) {
  if (players[ws.id] == null) {return}
  players[ws.id].direction = data.direction
  console.log(direction);
}

wss.on("connection", (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ws.id = uuidv4();
  console.log(`Client connecté - ID: ${ws.id} - IP: ${ip}`);
  
  ws.on("message", (msg) => {
    const data = JSON.parse(msg)
    if (data.type == "join-game") {
      player_join(ws, data);
    } else if(data.type == "update_direction") {
      update_direction(ws, data)
    }
  });
});
