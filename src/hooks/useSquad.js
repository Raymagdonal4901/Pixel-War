import { useState, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'pixel_war_deployed_squad';

/**
 * Hook to manage the Boss Raid deployed squad.
 * maxSquadSize is now dynamic — determined by the selected boss tier.
 */
export function useSquad(userHeroes, maxSquadSize = 30) {
  // Store deployed hero instanceIds
  const [deployedIds, setDeployedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deployedIds));
    } catch (e) {
      console.warn('Failed to save squad:', e);
    }
  }, [deployedIds]);

  // Clean up stale IDs (heroes that were decomposed) — done in useMemo to avoid effect cascading
  const activeDeployedIds = useMemo(() => {
    if (!userHeroes || userHeroes.length === 0) return deployedIds;
    const validIds = new Set(userHeroes.map(h => h.instanceId));
    const cleaned = deployedIds.filter(id => validIds.has(id));
    return cleaned.length !== deployedIds.length ? cleaned : deployedIds;
  }, [deployedIds, userHeroes]);

  // Auto-trim: if squad exceeds current boss's maxSlots, remove excess from the end
  useEffect(() => {
    if (activeDeployedIds.length > maxSquadSize) {
      setDeployedIds(activeDeployedIds.slice(0, maxSquadSize));
    }
  }, [maxSquadSize, activeDeployedIds]);

  // Derived: deployed heroes (full objects, ordered) — capped to maxSquadSize
  const deployedHeroes = useMemo(() => {
    const heroMap = new Map(userHeroes.map(h => [h.instanceId, h]));
    return activeDeployedIds
      .slice(0, maxSquadSize)
      .map(id => heroMap.get(id))
      .filter(Boolean);
  }, [activeDeployedIds, userHeroes, maxSquadSize]);

  // Derived: available heroes (NOT deployed)
  const availableHeroes = useMemo(() => {
    const deployedSet = new Set(activeDeployedIds.slice(0, maxSquadSize));
    return userHeroes.filter(h => !deployedSet.has(h.instanceId));
  }, [activeDeployedIds, userHeroes, maxSquadSize]);

  const squadCount = deployedHeroes.length;
  const isFull = squadCount >= maxSquadSize;

  /**
   * Deploy a hero to the squad. Returns false if full.
   */
  const deployHero = (instanceId) => {
    if (isFull) return false;
    if (deployedIds.includes(instanceId)) return false;
    
    // Prevent deployment of damaged heroes
    const hero = userHeroes.find(h => h.instanceId === instanceId);
    if (hero?.needsRepair) return false;

    setDeployedIds(prev => [...prev, instanceId]);
    return true;
  };

  /**
   * Remove a hero from the squad (back to available).
   */
  const undeployHero = (instanceId) => {
    setDeployedIds(prev => prev.filter(id => id !== instanceId));
  };

  /**
   * Deploy all available heroes (up to capacity) — sorted by ATK DESC (strongest first).
   */
  const deployAll = () => {
    const remaining = maxSquadSize - squadCount;
    if (remaining <= 0) return;
    
    // Sort available heroes by power level (ATK descending)
    const sorted = [...availableHeroes]
      .filter(h => !h.needsRepair)
      .sort((a, b) => (b.atk || 0) - (a.atk || 0));

    const toAdd = sorted
      .slice(0, remaining)
      .map(h => h.instanceId);
      
    setDeployedIds(prev => [...prev, ...toAdd]);
  };

  /**
   * Remove all heroes from squad.
   */
  const undeployAll = () => {
    setDeployedIds([]);
  };

  // Total ATK of deployed squad
  const totalAtk = useMemo(() => {
    return deployedHeroes.reduce((sum, h) => sum + (h.atk || 0), 0);
  }, [deployedHeroes]);

  return {
    deployedHeroes,
    availableHeroes,
    deployedIds,
    squadCount,
    maxSquadSize,
    isFull,
    totalAtk,
    deployHero,
    undeployHero,
    deployAll,
    undeployAll,
  };
}
