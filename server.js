
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const rooms = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("☣ ZOMBIE APOCALYPSE MULTIPLAYER ONLINE ☣");
});

const io = new Server(server, {
  cors: { origin: "*" }
});

function cleanRoom(value) {
  return String(value || "public")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 20) || "public";
}

io.on("connection", socket => {

  socket.on("join", data => {
    if (socket.data.room) return;

    const room = cleanRoom(data && data.room);

    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }

    const players = rooms.get(room);

    if (players.size >= MAX_PLAYERS) {
      socket.emit("room:full");
      return;
    }

    socket.data.room = room;

    const player = {
      id: socket.id,
      name: String(data.name || "Survivor").slice(0, 16),
      x: 0,
      z: 6,
      yaw: 0
    };

    players.set(socket.id, player);
    socket.join(room);

    socket.emit("room:state", [...players.values()]);

    socket.to(room).emit("player:joined", player);

    io.to(room).emit("room:count", players.size);
  });

  socket.on("player:move", data => {
    const room = socket.data.room;
    if (!room || !rooms.has(room) || !data) return;

    const player = rooms.get(room).get(socket.id);
    if (!player) return;

    const x = Number(data.x);
    const z = Number(data.z);
    const yaw = Number(data.yaw);

    if (![x, z, yaw].every(Number.isFinite)) return;
    if (Math.abs(x) > 500 || Math.abs(z) > 500) return;

    player.x = x;
    player.z = z;
    player.yaw = yaw;

    socket.to(room).emit("player:moved", {
      id: socket.id,
      x,
      z,
      yaw
    });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;

    const players = rooms.get(room);
    players.delete(socket.id);

    socket.to(room).emit("player:left", socket.id);

    if (players.size === 0) {
      rooms.delete(room);
    } else {
      io.to(room).emit("room:count", players.size);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("☣ MULTIPLAYER SERVER STARTED ☣");
  console.log("Port: " + PORT);
});
