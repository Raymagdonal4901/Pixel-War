import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const SEED_AMOUNT = 1;
const DEV_FEE = 0.10;

// Central Game State
let currentRound = 103;
let pool = { red: SEED_AMOUNT, blue: SEED_AMOUNT };
let matchHistory = [];
// This stores basic info about current and upcoming matches 
// The actual logic of pairs is currently handled fully synchronized by the frontend,
// so the backend primarily acts as the "Pool" Sync.

// Helper to get time until next even hour locally
const getNextEvenHourMs = () => {
  const d = new Date();
  let nextHour = d.getHours() + 1;
  if (nextHour % 2 !== 0) nextHour += 1; // Round up to nearest even hour

  const nextDate = new Date(d);
  nextDate.setHours(nextHour, 0, 0, 0);

  // If next is tomorrow 00:00, it handles automatically because date rolls over
  if (nextHour >= 24) {
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
  }

  return nextDate.getTime() - d.getTime();
};

let matchStatus = 'OPEN'; // 'OPEN' or 'LOCKED'

const updateClock = () => {
    const msUntil = getNextEvenHourMs();
    const secondsUntil = Math.floor(msUntil / 1000);

    // Lock 60 seconds before match ends
    if (secondsUntil <= 60 && secondsUntil > 0) {
        matchStatus = 'LOCKED';
    } else if (secondsUntil <= 0) {
        matchStatus = 'RESULT';
    } else {
        matchStatus = 'OPEN';
    }

    return { secondsUntil, status: matchStatus };
};

// Tick every second to broadcast the global pool and timer
setInterval(() => {
  const clock = updateClock();

  if (clock.status === 'RESULT') {
      // Simulate result end round handling...
      // Realistically we wait for result window to finish, reset pool
      // For MVP, we'll just clear the pool as soon as the window passes.
      // E.g., if secondsUntil hits the exact next hour mark (close to 0), reset pool.
      // To strictly match the frontend, frontend handles its own reset based on hour.
      // So backend just resets pool when new hour starts.
      pool = { red: SEED_AMOUNT, blue: SEED_AMOUNT };
      currentRound++;
      matchStatus = 'OPEN';
  }

  io.emit('poolSync', {
    pool,
    totalPool: pool.red + pool.blue,
    status: matchStatus,
    clock: clock.secondsUntil
  });
}, 1000);

io.on('connection', (socket) => {
  console.log(`[Socket] Player connected: ${socket.id}`);

  // Send initial state immediately
  socket.emit('poolSync', {
    pool,
    totalPool: pool.red + pool.blue,
    status: matchStatus,
    clock: updateClock().secondsUntil
  });

  socket.on('placeBet', (data) => {
    // data: { side: 'red' | 'blue', amount: 1 }
    if (matchStatus === 'LOCKED') {
        socket.emit('betError', 'Match is locked!');
        return;
    }

    if (data.side === 'red') {
      pool.red += data.amount || 1;
    } else if (data.side === 'blue') {
      pool.blue += data.amount || 1;
    }

    console.log(`[Bet] ${socket.id} bet ${data.amount} on ${data.side.toUpperCase()}. Red=${pool.red}, Blue=${pool.blue}`);
    
    // Immediately sync the pool so it feels instant
    io.emit('poolSync', {
      pool,
      totalPool: pool.red + pool.blue,
      status: matchStatus,
      clock: updateClock().secondsUntil
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Player disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Pixel War Arcade Backend running on http://localhost:${PORT}`);
});
