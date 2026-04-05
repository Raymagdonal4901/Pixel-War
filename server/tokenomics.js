/**
 * Server-Side Tokenomics Constants
 * Mirrors the client-side tokenomics.js for server calculations
 */

export const BASE_RATE_PER_ATK = 0.001;        // TON earned per 1 ATK per day
export const MINING_BATTERY_DURATION = 86400;   // Battery lasts 24 hours (seconds)
export const BATTERY_DRAIN_PER_HOUR = 100 / 24; // ~4.167% per hour
export const MINING_RECHARGE_FEE = 0.1;         // 0.1 TON per hero to recharge

export const TIER_PRICING = {
  Common: 1,
  Rare: 3,
  SR: 5,
  Epic: 7,
  Legendary: 10
};

export const TIER_TO_RARITY = { 1: 'Common', 2: 'Rare', 3: 'SR', 4: 'Epic', 5: 'Legendary' };

export const BOSSES = [
  {
    id: 1, name: "Scavenger", tier: 1,
    maxSlots: 10, multiplier: 1.00, baseHp: 100000,
    bonusLabel: "+0%", image: "/boss/boss_1.png", color: "#e74c3c",
  },
  {
    id: 2, name: "Iron Clad", tier: 2,
    maxSlots: 10, multiplier: 1.15, baseHp: 500000,
    bonusLabel: "+15%", image: "/boss/boss_2.png", color: "#2ecc71",
  },
  {
    id: 3, name: "Mecha Core", tier: 3,
    maxSlots: 10, multiplier: 1.30, baseHp: 2000000,
    bonusLabel: "+30%", image: "/boss/boss_3.png", color: "#3498db",
  },
  {
    id: 4, name: "Titan Orb", tier: 4,
    maxSlots: 10, multiplier: 1.50, baseHp: 8000000,
    bonusLabel: "+50%", image: "/boss/boss_4.png", color: "#9b59b6",
  },
  {
    id: 5, name: "Doomsday", tier: 5,
    maxSlots: 10, multiplier: 2.00, baseHp: 50000000,
    bonusLabel: "+100%", image: "/boss/boss_5.png", color: "#f1c40f",
  },
];
