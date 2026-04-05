import MiningSlot from './models/MiningSlot.js';
import Player from './models/Player.js';
import { BASE_RATE_PER_ATK, BATTERY_DRAIN_PER_HOUR, BOSSES } from './tokenomics.js';

/**
 * ═══════════════════════════════════════════════════════════
 * HOURLY CRON JOB — Batch process all miners every hour
 * ═══════════════════════════════════════════════════════════
 */
export async function processHourlySync() {
  const startTime = Date.now();
  console.log('⏳ [CRON] Starting hourly mining sync...');

  try {
    // 1. Get all active mining slots (has hero + battery > 0)
    const activeSlots = await MiningSlot.find({
      heroData: { $ne: null },
      battery: { $gt: 0 }
    });

    if (activeSlots.length === 0) {
      console.log('⏳ [CRON] No active miners. Skipping.');
      return;
    }

    // 2. Extract unique wallets
    const uniqueWallets = [...new Set(activeSlots.map(s => s.wallet))];

    // 3. Process each wallet using forceSync (Batch process to prevent locking)
    const BATCH_SIZE = 50;
    for (let i = 0; i < uniqueWallets.length; i += BATCH_SIZE) {
      const batch = uniqueWallets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(w => forceSync(w)));
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [CRON] Hourly sync completed in ${elapsed}ms. Processed ${uniqueWallets.length} players.`);

  } catch (err) {
    console.error('❌ [CRON] Hourly sync failed:', err);
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * FORCE SYNC — Calculate partial progress since last sync
 * Called before any important player action (claim, assign, etc.)
 * ═══════════════════════════════════════════════════════════
 */
export async function forceSync(wallet) {
  try {
    const player = await Player.findOne({ wallet });
    if (!player) return null;

    const now = new Date();
    const lastSync = player.lastMiningSync || now;
    const elapsedMs = now.getTime() - lastSync.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Let it calculate even if it's less than 3.6 seconds, ensuring exact millisecond precision.

    // Get active slots for this player
    const activeSlots = await MiningSlot.find({
      wallet,
      heroData: { $ne: null },
      battery: { $gt: 0 }
    });

    if (activeSlots.length === 0) {
      player.lastMiningSync = now;
      await player.save();
      return player;
    }

    // If player has no personalized boss states yet, initialize them
    if (!player.bossStates || player.bossStates.length === 0) {
      player.bossStates = BOSSES.map(b => ({
        tier: b.tier,
        currentHp: b.baseHp,
        baseHp: b.baseHp,
        name: b.name,
        multiplier: b.multiplier
      }));
    }

    const bossMap = {};
    player.bossStates.forEach(bz => { bossMap[bz.tier] = bz; });

    // --- Data Migration (Legacy support) ---
    // If top-level pendingYield exists (>0), move it to boss 1 and clear top-level
    if (player.pendingYield && player.pendingYield > 0) {
      if (player.bossStates[0]) {
        player.bossStates[0].pendingYield = (player.bossStates[0].pendingYield || 0) + player.pendingYield;
        player.pendingYield = 0;
        player.markModified('bossStates');
      }
    }

    const damagePerZone = {};
    const slotUpdates = [];

    for (const slot of activeSlots) {
      const boss = bossMap[slot.bossZone];
      if (!boss) continue;

      const atk = slot.heroData.atk || 0;
      const multiplier = boss.multiplier || 1.0;

      // Proportional yield & damage
      const yieldForPeriod = (atk * BASE_RATE_PER_ATK * multiplier) * (elapsedHours / 24);
      const damageForPeriod = atk * (elapsedHours / 24);
      const batteryDrain = BATTERY_DRAIN_PER_HOUR * elapsedHours;
      const newBattery = Math.max(0, slot.battery - batteryDrain);

      // Add yield specifically to this boss
      boss.pendingYield = (boss.pendingYield || 0) + yieldForPeriod;

      if (!damagePerZone[slot.bossZone]) damagePerZone[slot.bossZone] = 0;
      damagePerZone[slot.bossZone] += damageForPeriod;

      slotUpdates.push({
        updateOne: {
          filter: { _id: slot._id },
          update: { $set: { battery: newBattery } }
        }
      });
    }

    // Apply damage to personal bosses directly
    for (const [tierStr, damage] of Object.entries(damagePerZone)) {
      const tier = parseInt(tierStr);
      const bossIndex = player.bossStates.findIndex(b => b.tier === tier);
      if (bossIndex === -1) continue;

      let newHp = player.bossStates[bossIndex].currentHp - damage;
      if (newHp <= 0) {
        const bossData = BOSSES.find(b => b.tier === tier);
        newHp = bossData ? bossData.baseHp : 100000;
      }
      player.bossStates[bossIndex].currentHp = newHp;
    }

    // Write slot updates
    if (slotUpdates.length > 0) await MiningSlot.bulkWrite(slotUpdates);

    player.lastMiningSync = now;
    // Mongoose needs to know the array was modified
    player.markModified('bossStates');
    await player.save();

    return player;

  } catch (err) {
    console.error(`❌ [ForceSync] Error for ${wallet}:`, err);
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * GET MINING STATE — Build full state object for a player
 * ═══════════════════════════════════════════════════════════
 */
export async function getMiningState(wallet) {
  try {
    const [player, slots] = await Promise.all([
      Player.findOne({ wallet }),
      MiningSlot.find({ wallet }).sort({ bossZone: 1, slotIndex: 1 })
    ]);

    if (!player) return null;

    // Use player's personal boss states, fallback to default BOSSES if not yet initialized
    const playerBosses = player.bossStates && player.bossStates.length === 5 
      ? player.bossStates 
      : BOSSES.map(b => ({ tier: b.tier, currentHp: b.baseHp, baseHp: b.baseHp, name: b.name, multiplier: b.multiplier, pendingYield: 0 }));

    // Calculate total pending yield for overall visibility on client if needed
    const totalPending = playerBosses.reduce((sum, b) => sum + (b.pendingYield || 0), 0);

    // Build zones array matching client structure
    const zones = playerBosses.map(bz => {
      const zoneSlots = slots.filter(s => s.bossZone === bz.tier);
      return {
        bossIndex: bz.tier - 1,
        hp: bz.currentHp,
        baseHp: bz.baseHp,
        multiplier: bz.multiplier,
        name: bz.name,
        pendingYield: bz.pendingYield || 0, // ZONE-SPECIFIC YIELD
        pods: zoneSlots.map(s => ({
          id: s.slotIndex,
          unlocked: s.unlocked,
          unlockCost: s.unlockCost,
          heroInstanceId: s.heroData?.instanceId || null,
          heroData: s.heroData,
          battery: s.battery,
          assignedAt: s.assignedAt?.getTime() || null
        }))
      };
    });

    return {
      currentBossIndex: 0, // Client manages which boss is being viewed
      pendingYield: totalPending,
      gameBalance: player.gameBalance,
      lastUpdated: player.lastMiningSync?.getTime() || Date.now(),
      zones
    };
  } catch (err) {
    console.error(`❌ [getMiningState] Error for ${wallet}:`, err);
    return null;
  }
}
