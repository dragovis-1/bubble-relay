// 버블아케이드 멀티 중계 서버
// 4자리 방 코드로 플레이어끼리 메시지를 이어준다. 게임 계산은 방장 기기가 하고,
// 서버는 방 관리(만들기/참가/나가기)와 메시지 전달만 한다.
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const MAX = 4;              // 방 하나 최대 인원
const MAX_ROOMS = 300;
const rooms = new Map();    // code -> { host, started, players: Map(id -> {ws, name, char}) }
let nextId = 1;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end("BUBBLE ARCADE relay OK · rooms " + rooms.size);
});
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function list(room) {
  return [...room.players].map(([id, p]) => ({ id, name: p.name, char: p.char }));
}
function lobby(room) {
  for (const p of room.players.values()) send(p.ws, { t: "lobby", host: room.host, players: list(room), started: room.started });
}
function newCode() {
  for (let i = 0; i < 1000; i++) {
    const c = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
  return null;
}
const clean = (s, d) => String(s || d).replace(/[<>]/g, "").slice(0, 10);

wss.on("connection", (ws) => {
  const id = nextId++;
  let code = null;
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (buf) => {
    let m;
    try { m = JSON.parse(buf.toString()); } catch { return; }
    if (!m || typeof m.t !== "string") return;
    if (m.t === "ping") return send(ws, { t: "pong", at: m.at });

    if (m.t === "create") {
      if (code) return;
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: "error", msg: "서버가 꽉 찼어요. 잠시 후 다시 시도해 주세요" });
      code = newCode();
      if (!code) return send(ws, { t: "error", msg: "방을 만들 수 없어요" });
      const room = { host: id, started: false, players: new Map() };
      room.players.set(id, { ws, name: clean(m.name, "방장"), char: String(m.char || "pong").slice(0, 8) });
      rooms.set(code, room);
      send(ws, { t: "joined", code, id, host: id });
      return lobby(room);
    }
    if (m.t === "join") {
      if (code) return;
      const room = rooms.get(String(m.code));
      if (!room) return send(ws, { t: "error", msg: "없는 방 코드예요" });
      if (room.started) return send(ws, { t: "error", msg: "이미 게임 중인 방이에요" });
      if (room.players.size >= MAX) return send(ws, { t: "error", msg: "방이 꽉 찼어요 (4명)" });
      code = String(m.code);
      room.players.set(id, { ws, name: clean(m.name, "플레이어"), char: String(m.char || "pong").slice(0, 8) });
      send(ws, { t: "joined", code, id, host: room.host });
      return lobby(room);
    }

    // 그 밖의 메시지는 같은 방 사람들에게 그대로 전달 (to가 있으면 그 사람에게만)
    const room = code && rooms.get(code);
    if (!room) return;
    if (m.t === "char" && room.players.has(id)) { room.players.get(id).char = String(m.char || "pong").slice(0, 8); return lobby(room); }
    if (m.t === "start" && id !== room.host) return;
    if (m.t === "start") room.started = true;
    if (m.t === "lobbyback" && id === room.host) room.started = false;
    m.from = id;
    const out = JSON.stringify(m);
    for (const [pid, p] of room.players) {
      if (pid === id) continue;
      if (m.to && m.to !== pid) continue;
      if (p.ws.readyState === 1) p.ws.send(out);
    }
    if (m.t === "lobbyback") lobby(room);
  });

  ws.on("close", () => {
    const room = code && rooms.get(code);
    if (!room) return;
    room.players.delete(id);
    if (id === room.host || room.players.size === 0) {
      for (const p of room.players.values()) send(p.ws, { t: "closed" });
      rooms.delete(code);
    } else {
      for (const p of room.players.values()) send(p.ws, { t: "left", id });
      lobby(room);
    }
  });
});

// 끊긴 연결 정리
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 20000);

server.listen(PORT, () => console.log("bubble relay on", PORT));
