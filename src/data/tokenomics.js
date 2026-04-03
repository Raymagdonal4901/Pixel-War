/**
 * GameFi Tokenomics Constants & Helpers
 * ======================================
 * Base Rate: 1 ATK = 0.003 TON / day (24h)
 * Average ATK per pull ≈ 22.5
 * Target ROI: 10-15 days depending on boss tier
 */

// --- Core Constants ---
export const BASE_RATE_PER_ATK = 0.001;        // TON earned per 1 ATK per day
export const FIGHT_DURATION_SECONDS = 86400;    // 24 hours = 1 raid cycle
export const GACHA_COST_TON = 1;                // 1 pull = 1 TON
export const REPAIR_FEE_PERCENT = 0.15;         // 15% of daily yield

// --- PVP Constants ---
export const PVP_MODES = {
  DUEL_1V1: {
    fee: 1, // TON
    pool: 2, // 1 + 1
    winnerPrize: 1.8,
    devFee: 0.2
  },
  TEAM_3V3: {
    fee: 3, // TON per player
    pool: 6, // 3 + 3
    winnerPrize: 5.5,
    totalWinningTeamPrize: 5.5,
    devFee: 0.5
  }
};

// --- Drop Rates (out of 10000) ---
export const DROP_RATES = {
  Common:    5000,  // 50%
  Rare:      3000,  // 30%
  SR:        1500,  // 15%
  Epic:       400,  //  4%
  Legendary:  100,  //  1%
};

// --- ATK Values per Rarity ---
export const ATK_VALUES = {
  Common:      28,
  Rare:        64,
  SR:         235,
  Epic:       455,
  Legendary: 1200,
};

// Average ATK per pull = 0.50×28 + 0.30×64 + 0.15×235 + 0.04×455 + 0.01×1200 ≈ 98.65
export const AVG_ATK_PER_PULL = 98.65;

// --- Boss Tier Definitions ---
export const BOSSES = [
  {
    id: 1,
    name: "Scavenger",
    tier: 1,
    maxSlots: 10,
    multiplier: 1.00,
    bonusLabel: "+0%",
    roiDays: 14.8,
    image: "/boss/boss_1.png",
    color: "#e74c3c",
  },
  {
    id: 2,
    name: "Iron Clad",
    tier: 2,
    maxSlots: 20,
    multiplier: 1.10,
    bonusLabel: "+10%",
    roiDays: 13.4,
    image: "/boss/boss_2.png",
    color: "#2ecc71",
  },
  {
    id: 3,
    name: "Mecha Core",
    tier: 3,
    maxSlots: 30,
    multiplier: 1.20,
    bonusLabel: "+20%",
    roiDays: 12.3,
    image: "/boss/boss_3.png",
    color: "#3498db",
  },
  {
    id: 4,
    name: "Titan Orb",
    tier: 4,
    maxSlots: 40,
    multiplier: 1.30,
    bonusLabel: "+30%",
    roiDays: 11.4,
    image: "/boss/boss_4.png",
    color: "#9b59b6",
  },
  {
    id: 5,
    name: "Doomsday",
    tier: 5,
    maxSlots: 50,
    multiplier: 1.45,
    bonusLabel: "+45%",
    roiDays: 10.2,
    image: "/boss/boss_5.png",
    color: "#f1c40f",
  },
];

// --- Helper Functions ---

/**
 * Calculate daily TON earnings for a squad.
 * @param {number} squadAtk - Total ATK of deployed squad
 * @param {number} multiplier - Boss tier multiplier (e.g. 1.10)
 * @returns {number} TON earned per day
 */
export function calcDailyEarnings(squadAtk, multiplier = 1.0) {
  return squadAtk * BASE_RATE_PER_ATK * multiplier;
}

/**
 * Calculate repair cost for a single hero.
 * Cost = 15% of base daily earnings (without multiplier).
 * @param {number} atk - Hero's ATK stat
 * @returns {number} Repair cost in TON
 */
export function calcRepairCost(atk) {
  return atk * BASE_RATE_PER_ATK * REPAIR_FEE_PERCENT;
}

/**
 * Calculate Boss Max HP (based on squad ATK).
 * Max HP = squadAtk × 86400 (so the boss dies in exactly 24h)
 * @param {number} squadAtk
 * @returns {number}
 */
export function calcBossHp(squadAtk) {
  return squadAtk * FIGHT_DURATION_SECONDS;
}

/**
 * Calculate ROI in days.
 * @param {number} totalInvestedTon - Total TON spent on gacha
 * @param {number} dailyEarningTon - Daily earning in TON
 * @returns {number} Days to break even
 */
export function calcROI(totalInvestedTon, dailyEarningTon) {
  if (dailyEarningTon <= 0) return Infinity;
  return totalInvestedTon / dailyEarningTon;
}

/**
 * Calculate current raid progress.
 * @param {number} startTimestamp - When the raid started (ms)
 * @param {number} squadAtk - Total squad ATK
 * @param {number} multiplier - Boss tier multiplier
 * @returns {{ elapsedSec, hpPercent, earnedTon, isComplete }}
 */
export function calcRaidProgress(startTimestamp, squadAtk, multiplier = 1.0) {
  if (!startTimestamp || squadAtk <= 0) {
    return { elapsedSec: 0, hpPercent: 1, earnedTon: 0, isComplete: false };
  }

  const now = Date.now();
  const elapsedMs = now - startTimestamp;
  const elapsedSec = Math.min(elapsedMs / 1000, FIGHT_DURATION_SECONDS);
  const fractionOfDay = elapsedSec / FIGHT_DURATION_SECONDS;

  const bossMaxHp = calcBossHp(squadAtk);
  const currentDamage = squadAtk * elapsedSec;
  const hpPercent = Math.max(0, 1 - (currentDamage / bossMaxHp));

  const earnedTon = squadAtk * BASE_RATE_PER_ATK * multiplier * fractionOfDay;
  const isComplete = elapsedSec >= FIGHT_DURATION_SECONDS;

  return { elapsedSec, hpPercent, earnedTon, isComplete };
}
