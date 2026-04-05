import mongoose from 'mongoose';

const miningSlotSchema = new mongoose.Schema({
  wallet: {
    type: String,
    required: true,
    index: true
  },
  bossZone: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  slotIndex: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  unlocked: {
    type: Boolean,
    default: false
  },
  unlockCost: {
    type: Number,
    default: 1
  },
  // Embedded hero data (null = empty slot)
  heroData: {
    type: {
      instanceId: String,
      name: String,
      atk: Number,
      rarity: String,
      imagePath: String
    },
    default: null
  },
  battery: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  assignedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for fast queries
miningSlotSchema.index({ wallet: 1, bossZone: 1 });

/**
 * Initialize 50 mining slots for a new player (5 zones x 10 slots).
 * Slots 1-3 are unlocked free, 4-10 require payment.
 */
miningSlotSchema.statics.initializeForPlayer = async function (wallet, tierPricing) {
  const existing = await this.countDocuments({ wallet });
  if (existing >= 50) return; // Already initialized

  const slots = [];
  for (let zone = 1; zone <= 5; zone++) {
    const rarity = { 1: 'Common', 2: 'Rare', 3: 'SR', 4: 'Epic', 5: 'Legendary' }[zone];
    const cost = tierPricing[rarity] || 1;
    
    for (let slot = 1; slot <= 10; slot++) {
      slots.push({
        wallet,
        bossZone: zone,
        slotIndex: slot,
        unlocked: slot <= 3, // First 3 free
        unlockCost: cost,
        heroData: null,
        battery: 100,
        assignedAt: null
      });
    }
  }

  await this.insertMany(slots);
  console.log(`✅ [MiningSlot] Initialized 50 slots for ${wallet.slice(0, 8)}...`);
};

const MiningSlot = mongoose.model('MiningSlot', miningSlotSchema);

export default MiningSlot;
