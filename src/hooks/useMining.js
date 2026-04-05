import { useState, useEffect, useCallback, useRef } from 'react';
import { BASE_RATE_PER_ATK, MINING_BATTERY_DURATION, BOSSES, TIER_PRICING } from '../data/tokenomics';

const TIER_TO_RARITY = { 1: 'Common', 2: 'Rare', 3: 'SR', 4: 'Epic', 5: 'Legendary' };

/**
 * useMining Hook — Server-Synced with Client-Side Prediction
 * 
 * Real data lives on the server (MongoDB).
 * Client predicts HP/yield changes locally every second for smooth UI.
 * All actions are sent via socket, and server overwrites state on sync.
 */
export function useMining(userHeroes, socket, walletAddress) {
  const [miningState, setMiningState] = useState(() => {
    // 1. Fallback: Generate empty zones for initial render
    const freshZones = BOSSES.map((boss, index) => {
      const unlockCost = TIER_PRICING[TIER_TO_RARITY[boss.tier]] || 1;
      return {
        bossIndex: index,
        hp: boss.baseHp,
        baseHp: boss.baseHp,
        multiplier: boss.multiplier,
        name: boss.name,
        pendingYield: 0,
        pods: Array.from({ length: 10 }).map((_, pIdx) => ({
          id: pIdx + 1,
          unlocked: pIdx < 3,
          unlockCost: unlockCost,
          heroInstanceId: null,
          heroData: null,
          battery: 100
        }))
      };
    });

    return {
      lastUpdated: Date.now(),
      currentBossIndex: 0,
      pendingYield: 0,
      zones: freshZones,
      serverSynced: false
    };
  });
  
  const lastSyncRef = useRef(null);

  // ─── Hydrate from Cache on Wallet Connect/Refresh ───
  useEffect(() => {
    if (!walletAddress) return;

    // Only hydrate if we haven't synced with the server yet
    if (!miningState.serverSynced) {
      const cached = localStorage.getItem(`pixel_war_mining_cache_${walletAddress}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const hasBots = parsed.zones?.some(z => z.pods?.some(p => p.heroInstanceId || p.heroData));
          
          if (hasBots) {
            setMiningState({
              ...parsed,
              serverSynced: false,
              lastUpdated: Date.now()
            });
          }
        } catch (e) {
          console.warn('[Mining Hook] Hydration failed:', e);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]); // Only re-run when wallet changes

  // ─── Persist to Cache (with Protection) ───
  useEffect(() => {
    if (!walletAddress) return;

    // PROTECTION: Don't save if state is empty AND not synced with server
    const hasBots = miningState.zones?.some(z => z.pods?.some(p => p.heroInstanceId || p.heroData));
    
    if (miningState.serverSynced || hasBots) {
      localStorage.setItem(`pixel_war_mining_cache_${walletAddress}`, JSON.stringify(miningState));
    }
  }, [miningState, walletAddress]);

  // ─── Listen for server state sync ───
  useEffect(() => {
    if (!socket) return;

    const handleStateSync = (serverState) => {
      if (!serverState || !serverState.zones) return;

      setMiningState(prev => {
        // Omit currentBossIndex from serverState as client manages navigation
        const { currentBossIndex: _unused, ...restServerState } = serverState;
        
        return {
          ...prev,
          ...restServerState,
          lastUpdated: Date.now(),
          serverSynced: true
        };
      });
      lastSyncRef.current = Date.now();
    };

    const handleBossSync = (bossZones) => {
      if (!bossZones) return;
      setMiningState(prev => ({
        ...prev,
        zones: prev.zones.map(z => {
          const serverBoss = bossZones.find(bz => bz.tier === z.bossIndex + 1);
          if (serverBoss) {
            return { ...z, hp: serverBoss.currentHp };
          }
          return z;
        }),
        lastUpdated: Date.now()
      }));
    };

    socket.on('mining:stateSync', handleStateSync);
    socket.on('mining:bossSync', handleBossSync);

    // Request initial state
    const wallet = localStorage.getItem('ton_wallet_address');
    if (wallet) {
      socket.emit('mining:getState', { wallet });
    }

    return () => {
      socket.off('mining:stateSync', handleStateSync);
      socket.off('mining:bossSync', handleBossSync);
    };
  }, [socket]);

  // ─── Client-Side Prediction (visual only) ───
  useEffect(() => {
    const updatePrediction = () => {
      setMiningState(prev => {
        const now = Date.now();
        const elapsedSeconds = (now - prev.lastUpdated) / 1000;
        if (elapsedSeconds <= 0) return prev;

        const newZones = prev.zones.map(zone => {
          const currentBoss = BOSSES[zone.bossIndex] || BOSSES[0];
          let totalGenerated = 0;
          let totalDamage = 0;

          const newPods = zone.pods.map(pod => {
            if (!pod.heroInstanceId && !pod.heroData) return pod;
            
            const heroAtk = pod.heroData?.atk || 0;
            if (heroAtk <= 0 || pod.battery <= 0) return pod;

            const dailyYield = heroAtk * BASE_RATE_PER_ATK * (currentBoss.multiplier || zone.multiplier || 1);
            const yieldPerSec = dailyYield / 86400;

            const maxBatterySecs = (pod.battery / 100) * MINING_BATTERY_DURATION;
            const effectiveSecs = Math.min(elapsedSeconds, maxBatterySecs);

            totalGenerated += effectiveSecs * yieldPerSec;
            totalDamage += heroAtk * (effectiveSecs / 86400);

            const newBattery = Math.max(0, pod.battery - (effectiveSecs / MINING_BATTERY_DURATION) * 100);
            return { ...pod, battery: newBattery };
          });

          let fullHp = currentBoss.baseHp || zone.baseHp || 100000;
          let newHp = (zone.hp > 0) ? zone.hp - totalDamage : fullHp - totalDamage;
          
          // Auto-respawn
          while (newHp <= 0) {
            newHp += fullHp;
          }

          return {
            ...zone,
            pendingYield: (zone.pendingYield || 0) + totalGenerated,
            hp: newHp,
            pods: newPods
          };
        });

        const updatedZones = newZones;
        const totalPending = updatedZones.reduce((sum, z) => sum + (z.pendingYield || 0), 0);

        return {
          ...prev,
          lastUpdated: now,
          pendingYield: totalPending,
          zones: updatedZones
        };
      });
    };

    const interval = setInterval(updatePrediction, 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Actions (emit to server) ───

  const selectBoss = useCallback((index) => {
    if (index < 0 || index >= BOSSES.length) return;
    setMiningState(prev => ({
      ...prev,
      currentBossIndex: index
    }));
  }, []);

  const assignMech = useCallback((podId, heroInstanceId) => {
    if (!socket) return;
    
    const hero = userHeroes.find(h => h.instanceId === heroInstanceId);
    if (!hero) return;

    const currentBossIndex = miningState.currentBossIndex;
    const bossZone = currentBossIndex + 1; // tier is 1-indexed

    socket.emit('mining:assignMech', {
      bossZone,
      slotIndex: podId,
      heroData: {
        instanceId: hero.instanceId,
        name: hero.name,
        atk: hero.atk,
        rarity: hero.rarity,
        imagePath: hero.imagePath
      }
    });

    // Optimistic update
    setMiningState(prev => ({
      ...prev,
      lastUpdated: Date.now(),
      zones: prev.zones.map(z => z.bossIndex === currentBossIndex ? {
        ...z,
        pods: z.pods.map(p => p.id === podId ? { 
          ...p, 
          heroInstanceId: heroInstanceId,
          heroData: { instanceId: hero.instanceId, name: hero.name, atk: hero.atk, rarity: hero.rarity, imagePath: hero.imagePath },
          battery: 100,
          assignedAt: Date.now()
        } : p)
      } : z)
    }));
  }, [socket, userHeroes, miningState.currentBossIndex]);

  const removeMech = useCallback((podId) => {
    if (!socket) return;
    const currentBossIndex = miningState.currentBossIndex;
    const bossZone = currentBossIndex + 1;

    socket.emit('mining:removeMech', { bossZone, slotIndex: podId });

    // Optimistic update
    setMiningState(prev => ({
      ...prev,
      lastUpdated: Date.now(),
      zones: prev.zones.map(z => z.bossIndex === currentBossIndex ? {
        ...z,
        pods: z.pods.map(p => p.id === podId ? { ...p, heroInstanceId: null, heroData: null } : p)
      } : z)
    }));
  }, [socket, miningState.currentBossIndex]);

  const rechargeAll = useCallback(() => {
    if (!socket) return;
    socket.emit('mining:rechargeAll', {});

    // Optimistic update
    setMiningState(prev => ({
      ...prev,
      lastUpdated: Date.now(),
      zones: prev.zones.map(z => ({
        ...z,
        pods: z.pods.map(p => (p.heroInstanceId || p.heroData) ? { ...p, battery: 100 } : p)
      }))
    }));
  }, [socket]);

  const rechargeSlot = useCallback((podId) => {
    if (!socket) return;
    const currentBossIndex = miningState.currentBossIndex;
    const bossZone = currentBossIndex + 1;

    socket.emit('mining:rechargeSlot', { bossZone, slotIndex: podId });

    // Optimistic update
    setMiningState(prev => ({
      ...prev,
      lastUpdated: Date.now(),
      zones: prev.zones.map(z => z.bossIndex === currentBossIndex ? {
        ...z,
        pods: z.pods.map(p => p.id === podId ? { ...p, battery: 100 } : p)
      } : z)
    }));
  }, [socket, miningState.currentBossIndex]);

  const unlockPod = useCallback((podId) => {
    if (!socket) return;
    const currentBossIndex = miningState.currentBossIndex;
    const bossZone = currentBossIndex + 1;

    socket.emit('mining:unlockSlot', { bossZone, slotIndex: podId });

    // Optimistic update
    setMiningState(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.bossIndex === currentBossIndex ? {
        ...z,
        pods: z.pods.map(p => p.id === podId ? { ...p, unlocked: true } : p)
      } : z)
    }));
  }, [socket, miningState.currentBossIndex]);

  const claimYield = useCallback(() => {
    if (!socket) return 0;
    socket.emit('mining:claim', {});

    const claimed = miningState.pendingYield || 0;
    
    // Optimistic update
    setMiningState(prev => ({
      ...prev,
      pendingYield: 0,
      zones: prev.zones.map(z => ({ ...z, pendingYield: 0 }))
    }));

    return claimed;
  }, [socket, miningState.pendingYield]);

  const resetAllBosses = useCallback(() => {
    // Server handles boss respawn automatically, this is now a no-op
    console.log('Boss respawn is now automatic on server.');
  }, []);

  // Build miningHeroIds from all zones
  const miningHeroIds = miningState.zones.flatMap(z => 
    z.pods.filter(p => p.heroInstanceId || p.heroData?.instanceId)
      .map(p => p.heroInstanceId || p.heroData?.instanceId)
  );

  return {
    miningState,
    miningHeroIds,
    selectBoss,
    assignMech,
    removeMech,
    rechargeAll,
    unlockPod,
    rechargeSlot,
    claimYield,
    resetAllBosses
  };
}
