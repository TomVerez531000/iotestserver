const WebSocket = require("ws");
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

function send_data(ws, data) {
  const text = JSON.stringify(data);
  ws.send(text);
}

const TICK_RATE = 20;
players = {}
setInterval(() => {
  const dt = 1 / TICK_RATE;

  for (let ws in players) {
    if (ws.direction && (ws.direction.x !== 0 || ws.direction.y !== 0)) {
      
      if (ws.direction.x > 1 || ws.direction.y > 1) {ws.close();} // direction isnt normalized meaning the player try to speedhack with direction
      ws.x += ws.direction.x * PLAYER_SPEED * dt;
      ws.y += ws.direction.y * PLAYER_SPEED * dt;
    }
  }

  broadcastPositions();
}, 1000 / TICK_RATE);

function broadcastPositions() {
  const payload = {
    type: "update_world",
    players: {}
  };

  // On prépare les données (on n'envoie que le nécessaire)
  for (let ws in players) {
    payload.players[ws.id] = {
      x: ws.x,
      y: ws.y,
      size: ws.size
    };
  }

  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function get_spawn_pos(ws) {
  return {x:0, y:0}
}

var base_size = 100;
function player_join(ws, data) {
  const nickname = data.nickname
  if (nickname == null || nickname == "" || nickname.length > 20) {
    var message = {};
    message.type = "join-response";
    message.success = false;
    send_data(ws, message);
    return
  }

  players[ws] = true;
  var pos = get_spawn_pos(ws);
  ws.x = pos.x;
  ws.y = pos.y;
  ws.size = base_size;
  
  var message = {};
  message.type = "join-response";
  message.success = true;
  message.player_id = ws.id;
  send_data(ws, message);
}

function update_direction(ws, data) {
  if (!players[ws]) {return}
  ws.direction = data.direction;
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
