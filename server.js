import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const rooms = new Map();

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'room_not_found' });
  res.json(room);
});

app.put('/api/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = { ...req.body, code };
  rooms.set(code, room);
  io.to(code).emit('room:update', room);
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] },
  maxHttpBufferSize: 1e8
});

io.on('connection', (socket) => {
  socket.on('room:join', (code) => {
    const clean = String(code || '').toUpperCase();
    socket.join(clean);
    const room = rooms.get(clean);
    if (room) socket.emit('room:update', room);
  });
});

server.listen(PORT, () => {
  console.log(`Quizshow sync server läuft auf http://localhost:${PORT}`);
});
