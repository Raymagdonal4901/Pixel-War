import mongoose from 'mongoose';

import { BOSSES } from '../tokenomics.js';

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'Player1'
  },
  wallet: {
    type: String,
    required: true,
    unique: true
  },
  gameBalance: {
    type: Number,
    default: 0
  },
  pendingYield: {
    type: Number,
    default: 0
  },
  lastMiningSync: {
    type: Date,
    default: Date.now
  },
  bossStates: {
    type: [{
      tier: Number,
      currentHp: Number,
      baseHp: Number,
      name: String,
      multiplier: Number,
      pendingYield: { type: Number, default: 0 }
    }],
    default: () => BOSSES.map(b => ({
      tier: b.tier,
      currentHp: b.baseHp,
      baseHp: b.baseHp,
      name: b.name,
      multiplier: b.multiplier,
      pendingYield: 0
    }))
  },
  scrap: {
    type: Number,
    default: 0
  },
  dailyStreak: {
    type: Number,
    default: 0
  },
  lastCheckIn: {
    type: Date
  },
  completedTasks: {
    type: [String],
    default: []
  },
  mechTickets: {
    type: Number,
    default: 0
  },
  pvpStats: {
    count: { type: Number, default: 0 },
    lastResetDayId: { type: Number, default: -1 }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Player = mongoose.model('Player', playerSchema);

export default Player;
