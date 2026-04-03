import mongoose from 'mongoose';

const matchHistorySchema = new mongoose.Schema({
  roundId: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    enum: ['1v1', '3v3', 'arcade'],
    required: true
  },
  winner: {
    type: String,
    required: true
  },
  players: [
    {
      wallet: String,
      name: String,
      side: String,
      payout: Number
    }
  ],
  totalPool: {
    type: Number,
    required: true
  },
  devFee: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

const MatchHistory = mongoose.model('MatchHistory', matchHistorySchema);

export default MatchHistory;
