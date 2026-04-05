import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import process from 'process';

dotenv.config();
import connectDB from './db.js';
import Player from './models/Player.js';
import MatchHistory from './models/MatchHistory.js';
import MiningSlot from './models/MiningSlot.js';
import { TIER_PRICING, TIER_TO_RARITY, MINING_RECHARGE_FEE } from './tokenomics.js';
import { processHourlySync, forceSync, getMiningState } from './miningEngine.js';
import { getMissionStatus, processCheckIn, completeSocialTask, processCraft } from './missionEngine.js';

// Connect to MongoDB
connectDB().then(() => {
  console.log('✅ Base DB Connected.');
});

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
// Online Players Registry
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

// Helper to get time until next hour locally
const getNextHourMs = () => {
  const d = new Date();
  let nextHour = d.getHours() + 1;
  const nextDate = new Date(d);
  nextDate.setHours(nextHour, 0, 0, 0);
  return nextDate.getTime() - d.getTime();
};

let matchStatus = 'OPEN';
let matchmakingQueues = { '1v1': [], '3v3': [] };

const updateClock = () => {
    const msUntil = getNextHourMs();
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

// ═══════════════════════════════════════════════════════════
// CRON JOB — Hourly Mining Sync (every hour at minute 0)
// ═══════════════════════════════════════════════════════════
cron.schedule('0 * * * *', async () => {
  await processHourlySync();
});

console.log('⏰ [CRON] Hourly mining sync scheduled (minute 0 of every hour).');

// Tick every second for arcade pool
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

// ═══════════════════════════════════════════════════════════
// SOCKET CONNECTIONS
// ═══════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`[Socket] Player connected: ${socket.id} (Total: ${onlinePlayers.size + 1})`);

  // ─── Player Registration ───
  socket.on('registerPlayer', async (data) => {
    const walletAddr = data?.wallet;
    if (!walletAddr) return;

    try {
      let player = await Player.findOne({ wallet: walletAddr });
      
      if (player) {
        if (data.name && player.name !== data.name) {
          player.name = data.name;
        }
        player.lastSeen = new Date();
        await player.save();
      } else {
        player = await Player.create({
          name: data.name || 'Player1',
          wallet: walletAddr,
          gameBalance: 0,
          pendingYield: 0,
          lastMiningSync: new Date(),
          lastSeen: new Date()
        });
      }

      // Initialize mining slots if new player
      await MiningSlot.initializeForPlayer(walletAddr, TIER_PRICING);

      const playerInfo = {
        socketId: socket.id,
        name: player.name,
        wallet: `${player.wallet.slice(0, 4)}...${player.wallet.slice(-4)}`,
        fullWallet: player.wallet,
        joinedAt: Date.now(),
        dbId: player._id
      };

      onlinePlayers.set(socket.id, playerInfo);
      console.log(`[Register] ${playerInfo.name} (${socket.id}) registered. Online: ${onlinePlayers.size}`);

      broadcastOnlinePlayers();

      const missionStatus = await getMissionStatus(player.wallet);
      socket.emit('playerStatus', {
        balance: player.gameBalance,
        pvpStats: player.pvpStats,
        pendingYield: player.pendingYield,
        scrap: player.scrap,
        mechTickets: player.mechTickets
      });

      if (missionStatus) {
        socket.emit('mission:statusSync', missionStatus);
      }

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

  socket.emit('onlinePlayers', {
    count: onlinePlayers.size,
    players: getOnlinePlayersList()
  });

  // ═══════════════════════════════════════════════════════════
  // MINING SOCKET EVENTS
  // ═══════════════════════════════════════════════════════════

  // ─── Get Mining State ───
  socket.on('mining:getState', async (data) => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = data?.wallet || playerInfo?.fullWallet;
    if (!wallet) return;

    try {
      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
    } catch (err) {
      console.error('mining:getState error:', err);
    }
  });

  // ─── Assign Mech ───
  socket.on('mining:assignMech', async (data) => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const { bossZone, slotIndex, heroData } = data;
    if (!bossZone || !slotIndex || !heroData) return;

    try {
      // Force sync first
      await forceSync(wallet);

      // Validate rarity
      const requiredRarity = TIER_TO_RARITY[bossZone];
      if (heroData.rarity !== requiredRarity) {
        socket.emit('mining:error', { message: `Only ${requiredRarity} units allowed in Zone T${bossZone}` });
        return;
      }

      // Check slot exists and is unlocked
      const slot = await MiningSlot.findOne({ wallet, bossZone, slotIndex });
      if (!slot || !slot.unlocked) {
        socket.emit('mining:error', { message: 'Slot not found or locked' });
        return;
      }

      // Check hero not already assigned elsewhere
      const alreadyAssigned = await MiningSlot.findOne({ wallet, 'heroData.instanceId': heroData.instanceId });
      if (alreadyAssigned) {
        socket.emit('mining:error', { message: 'This hero is already mining' });
        return;
      }

      // Assign
      slot.heroData = {
        instanceId: heroData.instanceId,
        name: heroData.name,
        atk: heroData.atk,
        rarity: heroData.rarity,
        imagePath: heroData.imagePath
      };
      slot.battery = 100;
      slot.assignedAt = new Date();
      await slot.save();

      console.log(`[Mining] ${wallet.slice(0,8)}... assigned ${heroData.name} to T${bossZone} slot ${slotIndex}`);

      // Send updated state
      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
    } catch (err) {
      console.error('mining:assignMech error:', err);
    }
  });

  // ─── Remove Mech ───
  socket.on('mining:removeMech', async (data) => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const { bossZone, slotIndex } = data;

    try {
      const slot = await MiningSlot.findOne({ wallet, bossZone, slotIndex });
      if (!slot) return;

      if (slot.heroData && slot.assignedAt) {
        const currentTime = Date.now();
        const stakedTime = slot.assignedAt.getTime();
        const oneHourInMs = 60 * 60 * 1000;
        const timeElapsed = currentTime - stakedTime;

        if (timeElapsed < oneHourInMs) {
          const timeLeftMs = oneHourInMs - timeElapsed;
          const minutesLeft = Math.ceil(timeLeftMs / (60 * 1000));
          socket.emit('mining:error', { message: `ระบบป้องกันสแปม: กรุณารออีก ${minutesLeft} นาที จึงจะสามารถถอดหุ่นยนต์ได้` });
          return;
        }
      }

      await forceSync(wallet);

      slot.heroData = null;
      slot.assignedAt = null;
      await slot.save();

      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
    } catch (err) {
      console.error('mining:removeMech error:', err);
    }
  });

  // ─── Referral / Invite ───
  // (Existing referral logic remains, assuming it's handled via socket or http)
  
  // ═══════════════════════════════════════════════════════════
  // MISSION & EARN FREE MECH EVENTS
  // ═══════════════════════════════════════════════════════════
  
  // ─── Get Status ───
  socket.on('mission:getStatus', async () => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const status = await getMissionStatus(wallet);
    if (status) socket.emit('mission:statusSync', status);
  });

  // ─── Daily Check-in ───
  socket.on('mission:checkIn', async () => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const result = await processCheckIn(wallet);
    if (result.success) {
      socket.emit('mission:rewardClaimed', result);
      // Also update overall status
      const status = await getMissionStatus(wallet);
      socket.emit('mission:statusSync', status);
      // Update global balances
      socket.emit('playerStatus', { scrap: result.scrap, mechTickets: result.mechTickets });
    } else {
      socket.emit('mission:error', { message: result.error });
    }
  });

  // ─── Complete Social Task ───
  socket.on('mission:completeTask', async (data) => {
    const { taskId } = data;
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet || !taskId) return;

    const result = await completeSocialTask(wallet, taskId);
    if (result.success) {
      socket.emit('mission:rewardClaimed', result);
      const status = await getMissionStatus(wallet);
      socket.emit('mission:statusSync', status);
      socket.emit('playerStatus', { scrap: result.scrap, mechTickets: result.mechTickets });
    } else {
      socket.emit('mission:error', { message: result.error });
    }
  });

  // ─── Craft Mech ───
  socket.on('mission:craft', async () => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const result = await processCraft(wallet);
    if (result.success) {
      socket.emit('mission:crafted', result);
      const status = await getMissionStatus(wallet);
      socket.emit('mission:statusSync', status);
      socket.emit('playerStatus', { scrap: result.scrap, mechTickets: result.mechTickets });
    } else {
      socket.emit('mission:error', { message: result.error });
    }
  });

  // ─── Open Mech Box (Deduct Ticket) ───
  socket.on('mission:openBox', async () => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const player = await Player.findOne({ wallet });
    if (!player || (player.mechTickets || 0) < 1) {
        socket.emit('mission:error', { message: 'No tickets available' });
        return;
    }

    player.mechTickets -= 1;
    await player.save();

    socket.emit('mission:boxOpened', { success: true, mechTickets: player.mechTickets });
    socket.emit('playerStatus', { mechTickets: player.mechTickets });
    const status = await getMissionStatus(wallet);
    socket.emit('mission:statusSync', status);
  });

  // ─── Unlock Slot ───
  socket.on('mining:unlockSlot', async (data) => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    const { bossZone, slotIndex } = data;

    try {
      await forceSync(wallet);

      const slot = await MiningSlot.findOne({ wallet, bossZone, slotIndex });
      if (!slot) return;
      if (slot.unlocked) return;

      const player = await Player.findOne({ wallet });
      if (!player || player.gameBalance < slot.unlockCost) {
        socket.emit('mining:error', { message: `Insufficient balance. Need ${slot.unlockCost} TON` });
        return;
      }

      // Deduct cost
      player.gameBalance -= slot.unlockCost;
      await player.save();

      slot.unlocked = true;
      await slot.save();

      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
      socket.emit('playerStatus', { balance: player.gameBalance });
    } catch (err) {
      console.error('mining:unlockSlot error:', err);
    }
  });

  // ─── Claim Yield ───
  socket.on('mining:claim', async () => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    try {
      // Force sync to calculate all pending yield up to now
      const player = await forceSync(wallet);
      if (!player) return;

      // Calculate total from all boss sectors
      let totalToClaim = 0;
      if (player.bossStates && player.bossStates.length > 0) {
        player.bossStates.forEach(bs => {
          totalToClaim += (bs.pendingYield || 0);
          bs.pendingYield = 0;
        });
      }

      if (totalToClaim <= 0) {
        socket.emit('mining:error', { message: 'Nothing to claim' });
        return;
      }

      player.gameBalance += totalToClaim;
      player.markModified('bossStates');
      await player.save();

      console.log(`[Mining] ${wallet.slice(0,8)}... claimed ${totalToClaim.toFixed(4)} TON`);

      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
      socket.emit('mining:claimed', { amount: totalToClaim, newBalance: player.gameBalance });
      socket.emit('playerStatus', { balance: player.gameBalance });
    } catch (err) {
      console.error('mining:claim error:', err);
    }
  });

  // ─── Recharge All ───
  socket.on('mining:rechargeAll', async () => {
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet) return;

    try {
      await forceSync(wallet);

      const activeSlots = await MiningSlot.find({ wallet, heroData: { $ne: null } });
      if (activeSlots.length === 0) return;

      // Calculate total cost based on each robot's rarity
      const totalCost = activeSlots.reduce((sum, slot) => {
        const rarity = slot.heroData?.rarity || 'Common';
        return sum + (TIER_PRICING[rarity] || 1);
      }, 0);

      const player = await Player.findOne({ wallet });
      if (!player || player.gameBalance < totalCost) {
        socket.emit('mining:error', { message: `Insufficient balance. Need ${totalCost.toFixed(2)} TON` });
        return;
      }

      player.gameBalance -= totalCost;
      await player.save();

      // Recharge all active slots
      await MiningSlot.updateMany(
        { wallet, heroData: { $ne: null } },
        { $set: { battery: 100 } }
      );

      console.log(`[Mining] ${wallet.slice(0,8)}... recharged ${activeSlots.length} slots (Tiered Pricing) for ${totalCost.toFixed(2)} TON`);

      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
      socket.emit('playerStatus', { balance: player.gameBalance });
    } catch (err) {
      console.error('mining:rechargeAll error:', err);
    }
  });

  // ─── Recharge Single Slot ───
  socket.on('mining:rechargeSlot', async (data) => {
    const { bossZone, slotIndex } = data;
    const playerInfo = onlinePlayers.get(socket.id);
    const wallet = playerInfo?.fullWallet;
    if (!wallet || !bossZone || !slotIndex) return;

    try {
      await forceSync(wallet);

      const slot = await MiningSlot.findOne({ wallet, bossZone, slotIndex });
      if (!slot || !slot.heroData) {
        socket.emit('mining:error', { message: "Slot is empty or invalid." });
        return;
      }

      // Cost based on rarity
      const rarity = slot.heroData.rarity || 'Common';
      const rechargeCost = TIER_PRICING[rarity] || 1;

      const player = await Player.findOne({ wallet });
      if (!player || player.gameBalance < rechargeCost) {
        socket.emit('mining:error', { message: `Insufficient balance. Need ${rechargeCost} TON for ${rarity} unit.` });
        return;
      }

      player.gameBalance -= rechargeCost;
      await player.save();

      slot.battery = 100;
      await slot.save();

      console.log(`[Mining] ${wallet.slice(0,8)}... recharged ${rarity} slot ${slotIndex} in Zone ${bossZone} for ${rechargeCost} TON`);

      const state = await getMiningState(wallet);
      socket.emit('mining:stateSync', state);
      socket.emit('playerStatus', { balance: player.gameBalance });
    } catch (err) {
      console.error('mining:rechargeSlot error:', err);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ARCADE & PVP EVENTS (existing)
  // ═══════════════════════════════════════════════════════════

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

    console.log(`[Bet] ${socket.id} bet ${data.amount} on ${data.side.toUpperCase()}.`);
    
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

    const queue = matchmakingQueues[mode];
    if (queue.length > 0) {
      const opponent = queue.shift();
      if (opponent.socket.id === socket.id) {
          queue.push({ socket, player });
          return;
      }
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
  });

  socket.on('updatePlayer', (data) => {
    const existing = onlinePlayers.get(socket.id);
    if (existing) {
      if (data?.name) existing.name = data.name;
      if (data?.wallet) existing.wallet = `${data.wallet.slice(0, 4)}...${data.wallet.slice(-4)}`;
      onlinePlayers.set(socket.id, existing);
      broadcastOnlinePlayers();
    }
  });

  socket.on('disconnect', () => {
    const player = onlinePlayers.get(socket.id);
    const playerName = player?.name || 'Unknown';
    onlinePlayers.delete(socket.id);

    Object.keys(matchmakingQueues).forEach(mode => {
      matchmakingQueues[mode] = matchmakingQueues[mode].filter(q => q.socket.id !== socket.id);
    });

    console.log(`[Socket] ${playerName} disconnected: ${socket.id} (Total: ${onlinePlayers.size})`);
    broadcastOnlinePlayers();
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Pixel War Server running on http://localhost:${PORT}`);
});
