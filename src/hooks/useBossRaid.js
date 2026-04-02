import { useState, useEffect, useCallback, useRef } from 'react';
import { calcRaidProgress, calcDailyEarnings, calcBossHp, FIGHT_DURATION_SECONDS } from '../data/tokenomics';

const STORAGE_KEY = 'pixel_war_boss_raid';

/**
 * Hook to manage idle mining / boss raid state.
 * Tracks raid start time, calculates live progress via timestamps,
 * and manages reward claiming.
 */
export function useBossRaid(totalAtk, multiplier = 1.0) {
  const [raidState, setRaidState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { startTime: null, totalClaimed: 0 };
    } catch {
      return { startTime: null, totalClaimed: 0 };
    }
  });

  // Live progress state (updates every second while raid is active)
  const [progress, setProgress] = useState({ elapsedSec: 0, hpPercent: 1, earnedTon: 0, isComplete: false });
  const intervalRef = useRef(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raidState));
    } catch (e) {
      console.warn('Failed to save raid state:', e);
    }
  }, [raidState]);

  // Tick: Update progress every second while raid is active
  useEffect(() => {
    if (raidState.startTime && totalAtk > 0) {
      const tick = () => {
        const p = calcRaidProgress(raidState.startTime, totalAtk, multiplier);
        setProgress(p);
      };
      tick(); // immediate first tick
      intervalRef.current = setInterval(tick, 1000);
      return () => clearInterval(intervalRef.current);
    }
    // No else — we handle the default case below via derived state
  }, [raidState.startTime, totalAtk, multiplier]);

  // When raid is not active, derive default progress directly
  const effectiveProgress = (raidState.startTime && totalAtk > 0)
    ? progress
    : { elapsedSec: 0, hpPercent: 1, earnedTon: 0, isComplete: false };

  const isRaidActive = !!raidState.startTime;

  /**
   * Start a new raid. Records current timestamp.
   */
  const startRaid = useCallback(() => {
    if (totalAtk <= 0) return false;
    setRaidState(prev => ({ ...prev, startTime: Date.now() }));
    return true;
  }, [totalAtk]);

  /**
   * Claim the current reward and reset the raid.
   * Returns the amount of TON claimed.
   */
  const claimReward = useCallback(() => {
    if (!raidState.startTime) return 0;
    const p = calcRaidProgress(raidState.startTime, totalAtk, multiplier);
    const claimed = p.earnedTon;
    setRaidState(prev => ({
      startTime: null,
      totalClaimed: (prev.totalClaimed || 0) + claimed,
    }));
    return claimed;
  }, [raidState.startTime, totalAtk, multiplier]);

  /**
   * Cancel the current raid without claiming.
   */
  const cancelRaid = useCallback(() => {
    setRaidState(prev => ({ ...prev, startTime: null }));
  }, []);

  // Derived values
  const dailyEarning = calcDailyEarnings(totalAtk, multiplier);
  const bossMaxHp = calcBossHp(totalAtk);

  // Format elapsed time as HH:MM:SS
  const elapsedFormatted = (() => {
    const sec = Math.floor(effectiveProgress.elapsedSec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  // Remaining time
  const remainingFormatted = (() => {
    const remaining = Math.max(0, FIGHT_DURATION_SECONDS - Math.floor(effectiveProgress.elapsedSec));
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  return {
    isRaidActive,
    progress: effectiveProgress,
    dailyEarning,
    bossMaxHp,
    totalClaimed: raidState.totalClaimed || 0,
    elapsedFormatted,
    remainingFormatted,
    startRaid,
    claimReward,
    cancelRaid,
  };
}
