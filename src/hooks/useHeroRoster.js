import { useState, useEffect, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';

const MAX_HERO_CAPACITY = 100;
const STORAGE_KEY = 'pixel_war_hero_roster';
const RARITY_ORDER = ['Common', 'Rare', 'SR', 'Epic', 'Legendary'];

// Generate a simple unique ID
let _idCounter = Date.now();
const generateId = () => `hero_${_idCounter++}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Hook to manage the player's hero roster.
 * Persists heroes to localStorage.
 */
export function useHeroRoster() {
  const [userHeroes, setUserHeroes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let heroes = saved ? JSON.parse(saved) : [];
      
      // Robust Migration: Fix broken/old image paths
      heroes = heroes.map(hero => {
        const path = hero.imagePath || "";
        const isNewFormat = /\/Robot\/(common|rare|super_rare|epic|legendary)_\d+\.png/.test(path);
        
        if (!isNewFormat) {
          // Attempt to extract index from old heroId (robot_X) or imagePath (image_X)
          const idMatch = hero.heroId?.match(/robot_(\d+)/) || path.match(/image_(\d+)/);
          if (idMatch) {
            const oldIdx = parseInt(idMatch[1]);
            let newPath = path;
            
            if (oldIdx <= 120) {
              newPath = `/Robot/common_${((oldIdx - 1) % 99) + 1}.png`;
            } else if (oldIdx <= 200) {
              newPath = `/Robot/rare_${((oldIdx - 121) % 79) + 1}.png`;
            } else if (oldIdx <= 260) {
              newPath = `/Robot/super_rare_${((oldIdx - 201) % 60) + 1}.png`;
            } else if (oldIdx <= 290) {
              newPath = `/Robot/epic_${((oldIdx - 261) % 40) + 1}.png`;
            } else {
              newPath = `/Robot/legendary_${((oldIdx - 291) % 20) + 1}.png`;
            }
            return { ...hero, imagePath: newPath };
          }
          
          // Fallback: If no index found, map based solely on rarity to avoid broken image
          const prefixMap = { Common: 'common', Rare: 'rare', SR: 'super_rare', Epic: 'epic', Legendary: 'legendary' };
          const prefix = prefixMap[hero.rarity] || 'common';
          return { ...hero, imagePath: `/Robot/${prefix}_1.png` };
        }
        // Migration for new stats: def, spd, grade
        if (hero.def === undefined || hero.spd === undefined) {
          const statsMap = {
            'Common': { def: 5, spd: 10 },
            'Rare': { def: 15, spd: 30 },
            'SR': { def: 30, spd: 55 },
            'Epic': { def: 50, spd: 85 },
            'Legendary': { def: 120, spd: 180 }
          };
          const base = statsMap[hero.rarity] || statsMap.Common;
          return { 
            ...hero, 
            def: hero.def ?? base.def, 
            spd: hero.spd ?? base.spd, 
            grade: hero.grade ?? 'B',
            // Assign default 100% multipliers for legacy units
            hpMult: hero.hpMult ?? 1.0,
            atkMult: hero.atkMult ?? 1.0,
            defMult: hero.defMult ?? 1.0,
            spdMult: hero.spdMult ?? 1.0,
            element: hero.element ?? ['PLASMA', 'CRYO', 'BIO'][Math.floor(Math.random() * 3)]
          };
        }
        
        // Final fallback for missing element in otherwise migrated unit
        if (!hero.element) {
           hero.element = ['PLASMA', 'CRYO', 'BIO'][Math.floor(Math.random() * 3)];
        }

        // Migration: add base stats if missing (for upgrade system)
        if (hero.baseHp === undefined) {
          // For already-leveled heroes, reverse-calculate base stats
          const lvl = hero.level || 1;
          const mult = 1 + 0.10 * (lvl - 1);
          hero.baseHp = Math.round(hero.hp / mult);
          hero.baseAtk = Math.round(hero.atk / mult);
          hero.baseDef = Math.round(hero.def / mult);
          hero.baseSpd = Math.round(hero.spd / mult);
        }

        return hero;
      });

      return heroes;
    } catch {
      return [];
    }
  });

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userHeroes));
    } catch (e) {
      console.warn('Failed to save hero roster:', e);
    }
  }, [userHeroes]);

  const heroCount = userHeroes.length;

  /**
   * Check if adding `count` heroes would exceed capacity.
   */
  const canAdd = (count = 1) => heroCount + count <= MAX_HERO_CAPACITY;

  /**
   * Add an array of character objects (from gacha pulls) to the roster.
   * Each gets a unique instance ID, level, and timestamp.
   * Returns true if successful, false if capacity exceeded.
   */
  const addHeroes = (chars) => {
    if (!canAdd(chars.length)) return false;

    const newHeroes = chars.map(char => ({
      instanceId: generateId(),
      heroId: char.id,
      name: char.name,
      rarity: char.rarity,
      type: char.type,
      hp: char.hp,
      maxHp: char.maxHp || char.hp,
      atk: char.atk,
      def: char.def,
      spd: char.spd,
      baseHp: char.hp,
      baseAtk: char.atk,
      baseDef: char.def,
      baseSpd: char.spd,
      grade: char.grade,
      element: char.element || ['PLASMA', 'CRYO', 'BIO'][Math.floor(Math.random() * 3)],
      hpMult: char.hpMult,
      atkMult: char.atkMult,
      defMult: char.defMult,
      spdMult: char.spdMult,
      color: char.color,
      imageColor: char.imageColor,
      imagePath: char.imagePath,
      level: 1,
      obtainedAt: Date.now(),
    }));

    setUserHeroes(prev => [...prev, ...newHeroes]);
    return true;
  };

  /**
   * Remove a hero by instance ID.
   */
  const removeHero = (instanceId) => {
    setUserHeroes(prev => prev.filter(h => h.instanceId !== instanceId));
  };

  /**
   * Clear all heroes from the roster.
   */
  const clearRoster = () => {
    if (window.confirm('Are you sure you want to delete ALL heroes? This cannot be undone.')) {
      setUserHeroes([]);
    }
  };
  /**
   * Mark specific heroes as needing repair.
   */
  const damageHeroes = (instanceIds) => {
    const idSet = new Set(instanceIds);
    setUserHeroes(prev => prev.map(h => 
      idSet.has(h.instanceId) ? { ...h, needsRepair: true } : h
    ));
  };

  /**
   * Repair specific heroes.
   */
  const repairHeroes = (instanceIds) => {
    const idSet = new Set(instanceIds);
    setUserHeroes(prev => prev.map(h => 
      idSet.has(h.instanceId) ? { ...h, needsRepair: false } : h
    ));
  };

  // ============================================================
  // UPGRADE SYSTEM — Level up with duplicate (same heroId)
  // Max Lv.5, +10% stats per level
  // ============================================================

  const getDuplicates = (heroInstanceId) => {
    const target = userHeroes.find(h => h.instanceId === heroInstanceId);
    if (!target) return [];
    return userHeroes.filter(h => h.heroId === target.heroId && h.instanceId !== heroInstanceId);
  };

  const upgradeHero = (targetInstanceId, materialInstanceId) => {
    const target = userHeroes.find(h => h.instanceId === targetInstanceId);
    const material = userHeroes.find(h => h.instanceId === materialInstanceId);
    if (!target || !material) return null;
    if (target.heroId !== material.heroId) return null;
    if ((target.level || 1) >= 5) return null;

    const newLevel = (target.level || 1) + 1;
    const baseHp = target.baseHp || target.hp;
    const baseAtk = target.baseAtk || target.atk;
    const baseDef = target.baseDef || target.def;
    const baseSpd = target.baseSpd || target.spd;
    const levelMult = 1 + 0.10 * (newLevel - 1);

    const upgradedHero = {
      ...target,
      level: newLevel,
      hp: Math.floor(baseHp * levelMult),
      maxHp: Math.floor(baseHp * levelMult),
      atk: Math.floor(baseAtk * levelMult),
      def: Math.floor(baseDef * levelMult),
      spd: Math.floor(baseSpd * levelMult),
      baseHp, baseAtk, baseDef, baseSpd,
    };

    setUserHeroes(prev => prev
      .filter(h => h.instanceId !== materialInstanceId)
      .map(h => h.instanceId === targetInstanceId ? upgradedHero : h)
    );
    return upgradedHero;
  };

  // ============================================================
  // MERGE SYSTEM — 3 same-rarity → 1 higher rarity
  // ============================================================

  const getSameRarityHeroes = (rarity, excludeInstanceId) => {
    return userHeroes.filter(h => h.rarity === rarity && h.instanceId !== excludeInstanceId);
  };

  const mergeHeroes = (instanceIds) => {
    if (instanceIds.length !== 3) return null;
    const heroes = instanceIds.map(id => userHeroes.find(h => h.instanceId === id));
    if (heroes.some(h => !h)) return null;

    const rarity = heroes[0].rarity;
    if (!heroes.every(h => h.rarity === rarity)) return null;

    const currentIndex = RARITY_ORDER.indexOf(rarity);
    if (currentIndex < 0 || currentIndex >= RARITY_ORDER.length - 1) return null;

    const nextRarity = RARITY_ORDER[currentIndex + 1];
    const candidates = CHARACTERS.filter(c => c.rarity === nextRarity);
    if (candidates.length === 0) return null;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const newHero = {
      instanceId: generateId(),
      heroId: picked.id,
      name: picked.name,
      rarity: picked.rarity,
      type: picked.type,
      hp: picked.hp,
      maxHp: picked.maxHp || picked.hp,
      atk: picked.atk,
      def: picked.def,
      spd: picked.spd,
      baseHp: picked.hp,
      baseAtk: picked.atk,
      baseDef: picked.def,
      baseSpd: picked.spd,
      grade: picked.grade,
      element: picked.element || ['PLASMA', 'CRYO', 'BIO'][Math.floor(Math.random() * 3)],
      color: picked.color,
      imageColor: picked.imageColor,
      imagePath: picked.imagePath,
      level: 1,
      obtainedAt: Date.now(),
    };

    const burnSet = new Set(instanceIds);
    setUserHeroes(prev => [...prev.filter(h => !burnSet.has(h.instanceId)), newHero]);
    return newHero;
  };

  /**
   * Get count of heroes per rarity.
   */
  const rarityCounts = useMemo(() => {
    const counts = { Common: 0, Rare: 0, SR: 0, Epic: 0, Legendary: 0 };
    userHeroes.forEach(h => {
      if (counts[h.rarity] !== undefined) counts[h.rarity]++;
    });
    return counts;
  }, [userHeroes]);

  return {
    userHeroes,
    heroCount,
    maxCapacity: MAX_HERO_CAPACITY,
    canAdd,
    addHeroes,
    removeHero,
    clearRoster,
    rarityCounts,
    damageHeroes,
    repairHeroes,
    upgradeHero,
    mergeHeroes,
    getDuplicates,
    getSameRarityHeroes,
  };
}
