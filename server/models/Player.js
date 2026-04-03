import mongoose from 'mongoose';

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
