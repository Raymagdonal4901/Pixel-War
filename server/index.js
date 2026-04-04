import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
import connectDB from './db.js';
import Player from './models/Player.js';
import MatchHistory from './models/MatchHistory.js';

// Connect to MongoDB
connectDB();

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
let pool = { red: SEED_AMOUNT, blue: SEED_AMOUNT };

// ═══════════════════════════════════════════════════════════
// Online Players Registry — stores real player info
// Key: socket.id, Value: { name, wallet, joinedAt, socketId }
// ═══════════════════════════════════════════════════════════
const onlinePlayers = new Map();

const getOnlinePlayersList = () => {
  return Array.from(onlinePlayers.values()).map(p => ({
    id: p.socketId,
    name: p.name,
    wallet: p.wallet,
    joinedAt: p.joinedAt
  }));
};

const broadcastOnlinePlayers = async () => {
    try {
        const players = getOnlinePlayersList();
        const totalCount = await Player.countDocuments({});
        io.emit('onlinePlayers', {
            count: players.length,
            total: totalCount,
            players
        });
    } catch (err) {
        console.error('Error broadcasting player counts:', err);
    }
};

// Helper to get time until next even hour locally
const getNextEvenHourMs = () => {
  const d = new Date();
  let nextHour = d.getHours() + 1;
  if (nextHour % 2 !== 0) nextHour += 1;

  const nextDate = new Date(d);
  nextDate.setHours(nextHour, 0, 0, 0);

  if (nextHour >= 24) {
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
  }

  return nextDate.getTime() - d.getTime();
};

let matchStatus = 'OPEN';
let matchmakingQueues = { '1v1': [], '3v3': [] };

const updateClock = () => {
    const msUntil = getNextEvenHourMs();
    const secondsUntil = Math.floor(msUntil / 1000);

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
      pool = { red: SEED_AMOUNT, blue: SEED_AMOUNT };
      matchStatus = 'OPEN';
  }

  io.emit('poolSync', {
    pool,
    totalPool: pool.red + pool.blue,
    status: matchStatus,
    clock: clock.secondsUntil,
    onlineCount: onlinePlayers.size
  });
}, 1000);

io.on('connection', (socket) => {
  console.log(`[Socket] Player connected: ${socket.id} (Total: ${onlinePlayers.size + 1})`);

  // ═══════════════════════════════════════════════════════════
  // Player Registration — frontend sends player info on connect
  // ═══════════════════════════════════════════════════════════
  socket.on('registerPlayer', async (data) => {
    // data: { name: string, wallet: string }
    const walletAddr = data?.wallet;
    if (!walletAddr) return;

    try {
      // Find or Create Player in MongoDB
      let player = await Player.findOne({ wallet: walletAddr });
      
      if (player) {
        // Update name if changed
        if (data.name && player.name !== data.name) {
          player.name = data.name;
        }
        player.lastSeen = new Date();
        await player.save();
      } else {
        player = await Player.create({
          name: data.name || 'Player1',
          wallet: walletAddr,
          gameBalance: 0, // Initial balance
          lastSeen: new Date()
        });
      }

      const playerInfo = {
        socketId: socket.id,
        name: player.name,
        wallet: `${player.wallet.slice(0, 4)}...${player.wallet.slice(-4)}`,
        fullWallet: player.wallet, // Keep full for internal logic
        joinedAt: Date.now(),
        dbId: player._id
      };

      onlinePlayers.set(socket.id, playerInfo);
      console.log(`[Register] ${playerInfo.name} (${socket.id}) registered from DB. Online: ${onlinePlayers.size}`);

      // Broadcast updated player list
      broadcastOnlinePlayers();

      // Send player's DB status back to them
      socket.emit('playerStatus', {
        balance: player.gameBalance,
        pvpStats: player.pvpStats
      });

    } catch (err) {
      console.error(`❌ DB Error in registerPlayer: ${err.message}`);
    }
  });

  // Send initial state immediately
  socket.emit('poolSync', {
    pool,
    totalPool: pool.red + pool.blue,
    status: matchStatus,
    clock: updateClock().secondsUntil,
    onlineCount: onlinePlayers.size
  });

  // Send current online players list to the new connection
  socket.emit('onlinePlayers', {
    count: onlinePlayers.size,
    players: getOnlinePlayersList()
  });

  socket.on('placeBet', (data) => {
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
    
    io.emit('poolSync', {
      pool,
      totalPool: pool.red + pool.blue,
      status: matchStatus,
      clock: updateClock().secondsUntil,
      onlineCount: onlinePlayers.size
    });
  });

  socket.on('joinQueue', (data) => {
    const { mode, player } = data;
    if (!mode || !player) return;

    console.log(`[PVP] ${socket.id} (${player.name}) joined ${mode} queue.`);

    const queue = matchmakingQueues[mode];
    if (queue.length > 0) {
      const opponent = queue.shift();
      if (opponent.socket.id === socket.id) {
          queue.push({ socket, player });
          return;
      }

      console.log(`[PVP] Match found! ${socket.id} vs ${opponent.socket.id}`);

      socket.emit('matchFound', { opponent: opponent.player });
      opponent.socket.emit('matchFound', { opponent: player });
    } else {
      matchmakingQueues[mode].push({ socket, player });
    }
  });

  socket.on('leaveQueue', (data) => {
    const { mode } = data;
    if (!mode) return;
    matchmakingQueues[mode] = matchmakingQueues[mode].filter(q => q.socket.id !== socket.id);
    console.log(`[PVP] ${socket.id} left ${mode} queue.`);
  });

  // ═══════════════════════════════════════════════════════════
  // Player Update — allow re-registration (e.g., name change)
  // ═══════════════════════════════════════════════════════════
  socket.on('updatePlayer', (data) => {
    const existing = onlinePlayers.get(socket.id);
    if (existing) {
      if (data?.name) existing.name = data.name;
      if (data?.wallet) existing.wallet = `${data.wallet.slice(0, 4)}...${data.wallet.slice(-4)}`;
      onlinePlayers.set(socket.id, existing);
      broadcastOnlinePlayers();
      console.log(`[Update] ${existing.name} updated their info.`);
    }
  });

  socket.on('disconnect', () => {
    const player = onlinePlayers.get(socket.id);
    const playerName = player?.name || 'Unknown';
    onlinePlayers.delete(socket.id);

    // Remove from all queues
    Object.keys(matchmakingQueues).forEach(mode => {
      matchmakingQueues[mode] = matchmakingQueues[mode].filter(q => q.socket.id !== socket.id);
    });

    console.log(`[Socket] ${playerName} disconnected: ${socket.id} (Total: ${onlinePlayers.size})`);
    broadcastOnlinePlayers();
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Pixel War Arcade Backend running on http://localhost:${PORT}`);
});
