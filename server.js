const WebSocket = require("ws");
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

const MAP_SIZE = {x:10000, y:10000};

function send_data(ws, data) {
  const text = JSON.stringify(data);
  ws.send(text);
}

function get_player_speed(ws) {
  return (0.99**ws.size)*1000;
}

function clamp(a, x, y) {
  return Math.min(Math.max(a, x), y)
}

class Food {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
  }

  check_eaten(ply) {
    const magnitude = Math.sqrt((ply.x-this.x)**2 + (ply.y-this.y)**2);

    return magnitude <= ply.size;
  }
}

function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const FOOD_PER_CHUNK = 30;
const ENTITY_GRID_SIZE = 500;
const entity_grids = [];
function generateFood(mapSeed) {
  const spawnRandom = mulberry32(mapSeed);
  var counter = 0;
  for (var chunkX = 0; chunkX < Math.ceil(MAP_SIZE.x/ENTITY_GRID_SIZE); chunkX ++) {
    entity_grids[chunkX] = [];
    for (var chunkY = 0; chunkY < Math.ceil(MAP_SIZE.y/ENTITY_GRID_SIZE); chunkY ++) {
      let chunk = [];
      for(let i = 0; i < FOOD_PER_CHUNK; i++) {
        spawnRandom() // skip hue for ball color
        let offsetX = spawnRandom() * ENTITY_GRID_SIZE
        let offsetY = spawnRandom() * ENTITY_GRID_SIZE
        let x = chunkX*ENTITY_GRID_SIZE + offsetX - MAP_SIZE.x/2;
        let y = chunkY*ENTITY_GRID_SIZE + offsetY - MAP_SIZE.y/2;
        
        var f = new Food(x, y, 5);
        chunk.push(f);
        
        counter ++;
        f.id = counter;
      }
      entity_grids[chunkX][chunkY] = chunk;
    }
  }
}


let mapSeed = Math.floor(Math.random()*100000);
generateFood(mapSeed);
const MAX_CHUNK_X = Math.ceil(MAP_SIZE.x / ENTITY_GRID_SIZE) - 1;
const MAX_CHUNK_Y = Math.ceil(MAP_SIZE.y / ENTITY_GRID_SIZE) - 1;

const TICK_RATE = 20;
var players = {}
setInterval(() => {
  const dt = 1 / TICK_RATE;

  const eaten = {}
  for (let id in players) {
    var ws = players[id]
    if (ws == null) {continue}
    
    if (ws.direction && (ws.direction.x !== 0 || ws.direction.y !== 0)) {
      
      if (ws.direction.x > 1.01 || ws.direction.y > 1.01) {ws.close();} // direction isnt normalized meaning the player try to speedhack with direction
      ws.x = clamp(ws.x + (ws.direction.x * get_player_speed(ws) * dt), -MAP_SIZE.x/2, MAP_SIZE.x/2);
      ws.y = clamp(ws.y + (ws.direction.y * get_player_speed(ws) * dt), -MAP_SIZE.y/2, MAP_SIZE.y/2);

      var chunkX = Math.floor((ws.x+MAP_SIZE.x/2)/ENTITY_GRID_SIZE);
      var chunkY = Math.floor((ws.y+MAP_SIZE.y/2)/ENTITY_GRID_SIZE);
      chunkX = clamp(chunkX, 0, MAX_CHUNK_X);
      chunkY = clamp(chunkY, 0, MAX_CHUNK_Y);
      
      let chunk = entity_grids[chunkX][chunkY];
      for (let i = chunk.length - 1; i >= 0; i--) {
        const element = chunk[i];
        if (element.check_eaten(ws)) {
          if (eaten[id] == null) {eaten[id] = []}
          eaten[id].push(element.id);
          chunk.splice(i, 1);
          ws.size += 1
        }
      };
    }
  }

  broadcastPositions(eaten);
}, 1000 / TICK_RATE);

function broadcastPositions(eaten) {
  const payload = {
    type: "update_world",
    players: {}
  };

  // On prépare les données (on n'envoie que le nécessaire)
  for (let id in players) {
    var ws = players[id]
    if (ws == null) {continue;}
    
    payload.players[ws.id] = {
      x: ws.x,
      y: ws.y,
      size: ws.size,
      eaten: eaten[id]
    };
  }

  const message = JSON.stringify(payload);
  for (let id in players) {
    var ws = players[id]
    if (ws == null) {continue;}
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  };
}

function get_spawn_pos(ws) {
  return {x:0, y:0}
}

var base_size = 10;
function player_join(ws, data) {
  const nickname = data.nickname
  if (nickname == null || nickname == "" || nickname.length > 20) {
    var message = {};
    message.type = "join-response";
    message.success = false;
    send_data(ws, message);
    return
  }
  
  players[ws.id] = ws;
  var pos = get_spawn_pos(ws);
  ws.x = pos.x;
  ws.y = pos.y;
  ws.size = base_size;
  
  var message = {};
  message.type = "join-response";
  message.success = true;
  message.mapSeed = mapSeed;
  message.player_id = ws.id;
  send_data(ws, message);
}

function update_direction(ws, data) {
  if (!players[ws.id]) {return}
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

  ws.on("close", () => {
    delete players[ws.id];
  })
});
