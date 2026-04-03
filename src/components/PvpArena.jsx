import React, { useState, useEffect, useRef } from 'react';
import { CHARACTERS, RARITY_COLORS } from '../data/characters';
import { PVP_MODES } from '../data/tokenomics';
import { useT } from '../i18n/LanguageContext';

const ELEMENT_ICONS = {
  'PLASMA': '🔥',
  'CRYO': '💧',
  'BIO': '🌿'
};

// ═══════════════════════════════════════════════════════════
// PVP Combat Stats — Balanced for M=25, ~5 turn battles
// HP / (ATK × 25) ≈ 4.8 turns (matching user spec example)
// Hero grade multipliers (hpMult, atkMult) still apply on top
// ═══════════════════════════════════════════════════════════
const PVP_COMBAT_STATS = {
  Common:    { hp: 3000,  atk: 25 },
  Rare:      { hp: 5500,  atk: 45 },
  SR:        { hp: 8000,  atk: 65 },
  Epic:      { hp: 11000, atk: 90 },
  Legendary: { hp: 16000, atk: 130 },
};

/** Convert a hero to PvP-balanced combat stats while preserving grade advantage */
function toPvpCombatHero(hero, battleId) {
  const base = PVP_COMBAT_STATS[hero.rarity] || PVP_COMBAT_STATS.Common;
  const hpMult = hero.hpMult ?? 1.0;
  const atkMult = hero.atkMult ?? 1.0;
  const defMult = hero.defMult ?? 1.0;
  const spdMult = hero.spdMult ?? 1.0;
  
  const combatHp = Math.round(base.hp * hpMult);
  const combatAtk = Math.round(base.atk * atkMult);
  const combatDef = Math.round((hero.def || 10) * defMult);
  const combatSpd = Math.round((hero.spd || 10) * spdMult);

  return {
    ...hero,
    battleId,
    hp: combatHp,
    currentHp: combatHp,
    maxHp: combatHp,
    atk: combatAtk,
    def: combatDef,
    spd: combatSpd,
    turnCount: 0,
  };
}

function getElementalMultiplier(attackerElement, defenderElement) {
  if (attackerElement === 'PLASMA') {
    if (defenderElement === 'BIO') return 1.25;
    if (defenderElement === 'CRYO') return 0.80;
  }
  if (attackerElement === 'CRYO') {
    if (defenderElement === 'PLASMA') return 1.25;
    if (defenderElement === 'BIO') return 0.80;
  }
  if (attackerElement === 'BIO') {
    if (defenderElement === 'CRYO') return 1.25;
    if (defenderElement === 'PLASMA') return 0.80;
  }
  return 1.0;
}

const HeroSprite = ({ char, className = "" }) => {
  if (!char) return <span>🤖</span>;
  if (char.imagePath) {
    const src = char.imagePath.startsWith('/') ? char.imagePath : `/${char.imagePath}`;
    return (
      <img 
        src={src} 
        alt={char.name} 
        className={`${className} w-full h-full object-contain image-pixelated`}
        style={{ minWidth: '20px', minHeight: '20px' }}
      />
    );
  }
  const { sprite } = char;
  if (!sprite) return <span>🤖</span>;
  const cols = 8;
  const rows = 8; 
  return (
    <div 
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: `url('/${sprite.sheet}')`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${(sprite.col / (cols - 1)) * 100}% ${(sprite.row / (rows - 1)) * 100}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated'
      }}
    />
  );
};

const WatermarkBg = () => (
  <div 
    className="absolute inset-x-0 inset-y-0 z-0 opacity-[0.08] pointer-events-none bg-center bg-cover bg-no-repeat grayscale-[0.4]"
    style={{ backgroundImage: "url('/@fs/C:/Users/rayma/.gemini/antigravity/brain/650491d8-0df2-4a6c-85d2-2faa1d4043af/media__1774973956639.jpg')" }}
  ></div>
);

export default function PvpArena({ userHeroes, pvpStats, setPvpStats, onLongPressStart, onLongPressEnd }) {
  const { t } = useT();
  const [view, setView] = useState('lounge'); // 'lounge' | 'matchmaking' | 'battle' | 'result'
  const [mode, setMode] = useState('1v1'); // '1v1' | '3v3'

  // Persistent Squads for Lounge View
  const [selected1v1, setSelected1v1] = useState([0]); 
  const [selected3v3, setSelected3v3] = useState([0, 1, 2]);

  // Sync squads if userHeroes changes (minimal check)
  useEffect(() => {
    if (userHeroes.length > 0) {
      if (!selected1v1.length) setSelected1v1([0]);
      if (!selected3v3.length) setSelected3v3([0, 1, 2].filter(i => i < userHeroes.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userHeroes]);
  
  // Fight State
  const [playerTeam, setPlayerTeam] = useState([]);
  const [enemyTeam, setEnemyTeam] = useState([]);
  const [battleLogs, setBattleLogs] = useState([]);
  const [animState, setAnimState] = useState({
    attackerId: null,
    targetId: null,
    type: null, // 'melee-dash' | 'projectile-fire' | 'knockback' | 'dodge' | etc
    isReverse: false
  });
  const [winner, setWinner] = useState(null);
  

  
  // Selection/Battle Script State
  const [isPicking, setIsPicking] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]); // indices within userHeroes
  const battleStateRef = useRef({ player: [], enemy: [], step: 1 });
  const runningRef = useRef(false);

  const startMatchmaking = (selectedMode) => {
    setMode(selectedMode);
    // Use the persistent squad for the picked mode
    const initialIndices = selectedMode === '1v1' ? selected1v1 : selected3v3;
    setSelectedIndices(initialIndices);
    setIsPicking(true);
    setPlayerTeam([]);
    setEnemyTeam([]);
  };

  const confirmSelection = () => {
    // Update the persistent squad for this mode
    if (mode === '1v1') setSelected1v1(selectedIndices);
    else setSelected3v3(selectedIndices);

    // Convert player heroes to PVP-balanced combat stats
    const myTeam = selectedIndices.map((idx, i) => {
      const hero = userHeroes[idx];
      return toPvpCombatHero(hero, `p${i+1}`);
    });

    // Generate Opponents based on Rarity Matching (also PVP-balanced)
    const opponents = myTeam.map((h, i) => {
      const matchingRarity = CHARACTERS.filter(c => c.rarity === h.rarity);
      const enemy = matchingRarity[Math.floor(Math.random() * matchingRarity.length)];
      return toPvpCombatHero(enemy, `e${i+1}`);
    });

    setPlayerTeam(myTeam);
    setEnemyTeam(opponents);
    setIsPicking(false);
    battleStateRef.current = { player: myTeam, enemy: opponents, step: 1 };
    runningRef.current = false;
    setView('matchmaking');
  };

  const toggleHero = (index) => {
    const limit = mode === '1v1' ? 1 : 3;
    if (selectedIndices.includes(index)) {
      setSelectedIndices(prev => prev.filter(i => i !== index));
    } else if (selectedIndices.length < limit) {
      setSelectedIndices(prev => [...prev, index]);
    }
  };

  const payAndFight = () => {
    // Increment match count
    setPvpStats(prev => ({ ...prev, count: Math.min(5, prev.count + 1) }));
    setBattleLogs(["Match starts!"]);
    setView('battle');
    setWinner(null);
  };

  const addLog = (msg) => {
    setBattleLogs(prev => [msg, ...prev].slice(0, 5));
  };

  const currentSettings = mode === '1v1' ? PVP_MODES.DUEL_1V1 : PVP_MODES.TEAM_3V3;

  useEffect(() => {
    if (view !== 'battle' || winner || runningRef.current) return;
    
    runningRef.current = true;
    let turnTimeout;

    // ═══════════════════════════════════════════════════════════
    // DAMAGE FORMULA:
    // Final Damage = (ATK × M) × RNG × CRIT
    //   M = 25 (Skill Multiplier)
    //   RNG = random 0.85–1.15 (±15% swing)
    //   CRIT = 20% chance → 1.5x, else 1.0x
    // ═══════════════════════════════════════════════════════════
    const calcDamage = (attacker) => {
      const M = 25;
      const baseDmg = attacker.atk * M;
      const rng = 0.85 + Math.random() * 0.30; // 0.85 to 1.15
      const isCrit = Math.random() < 0.20;
      const critMult = isCrit ? 1.5 : 1.0;
      const finalDmg = Math.floor(baseDmg * rng * critMult);
      return { finalDmg, isCrit, rng: rng.toFixed(2) };
    };

    // Initiative Roll — 50/50 who goes first
    const playerGoesFirst = Math.random() > 0.5;
    battleStateRef.current.turnIndex = 0;
    battleStateRef.current.playerGoesFirst = playerGoesFirst;

    const combatStep = () => {
      if (winner || view !== 'battle') {
        runningRef.current = false;
        return;
      }

      const { player, enemy, turnIndex, playerGoesFirst } = battleStateRef.current;
      const aliveP = player.filter(p => p.currentHp > 0);
      const aliveE = enemy.filter(e => e.currentHp > 0);

      if (aliveP.length === 0 || aliveE.length === 0) {
        runningRef.current = false;
        return;
      }

      // Turn-based: alternate between player and enemy
      // Even turnIndex → first team, Odd turnIndex → second team
      const isPlayerTurn = (turnIndex % 2 === 0) ? playerGoesFirst : !playerGoesFirst;

      let attacker, target;
      if (mode === '1v1') {
        attacker = isPlayerTurn ? aliveP[0] : aliveE[0];
        target = isPlayerTurn ? aliveE[0] : aliveP[0];
      } else {
        // 3v3: cycle through alive units by SPD (fastest goes first)
        const attackTeam = isPlayerTurn ? [...aliveP].sort((a, b) => b.spd - a.spd) : [...aliveE].sort((a, b) => b.spd - a.spd);
        const defendTeam = isPlayerTurn ? aliveE : aliveP;
        const attackIdx = Math.floor(turnIndex / 2) % attackTeam.length;
        attacker = attackTeam[attackIdx];
        target = defendTeam[Math.floor(Math.random() * defendTeam.length)];
      }

      if (!attacker || !target) { runningRef.current = false; return; }

      // Animation
      setAnimState({
        attackerId: attacker.battleId,
        targetId: target.battleId,
        type: attacker.attackType === 'melee' ? 'melee-dash' : 'projectile-fire',
        effect: 'explosion', // Always explosion as requested
        isPlayerTurn,
        isHit: true,
        isSimultaneous: false
      });

      // Calculate damage using the user's formula
      const { finalDmg, isCrit } = calcDamage(attacker);
      const elementMult = getElementalMultiplier(attacker.element, target.element);
      const totalDamage = Math.floor(finalDmg * elementMult);

      let nextPlayer = [...player];
      let nextEnemy = [...enemy];

      let damageText = `${attacker.name} → ${target.name}: ${totalDamage} DMG`;
      if (isCrit) damageText += ' 💥 CRITICAL!';
      if (elementMult > 1.0) damageText += ' 🔥 SUPER EFFECTIVE!';
      if (elementMult < 1.0) damageText += ' 🛡️ NOT EFFECTIVE.';

      if (isPlayerTurn) {
        nextEnemy = nextEnemy.map(e => e.battleId === target.battleId ? {...e, currentHp: Math.max(0, e.currentHp - totalDamage)} : e);
      } else {
        nextPlayer = nextPlayer.map(p => p.battleId === target.battleId ? {...p, currentHp: Math.max(0, p.currentHp - totalDamage)} : p);
      }

      battleStateRef.current = { 
        player: nextPlayer, 
        enemy: nextEnemy, 
        turnIndex: turnIndex + 1,
        playerGoesFirst 
      };

      setTimeout(() => {
        addLog(damageText);
        setPlayerTeam(nextPlayer);
        setEnemyTeam(nextEnemy);

        const finalAliveP = nextPlayer.filter(p => p.currentHp > 0);
        const finalAliveE = nextEnemy.filter(e => e.currentHp > 0);
        if (finalAliveP.length === 0) setWinner('enemy');
        else if (finalAliveE.length === 0) setWinner('player');

        setTimeout(() => setAnimState({}), 800);
      }, 450);

      turnTimeout = setTimeout(combatStep, 2200);
    };

    turnTimeout = setTimeout(combatStep, 1000);
    return () => {
      clearTimeout(turnTimeout);
      runningRef.current = false;
    };
  }, [view, winner, mode]);

  if (view === 'lounge' && !isPicking) {

    return (
      <div className="flex flex-col items-center flex-1 p-4 animate-in fade-in relative min-h-full">
         <WatermarkBg />
         <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
            


            <h2 className="text-[#f1c40f] text-2xl font-bold mb-4 tracking-widest drop-shadow-md text-stroke-pvp italic uppercase">
              PVP ARENA
            </h2>
            
            <div className="flex flex-col gap-3 w-full">
              {/* 2-Hour Limit Display */}
              <div className="bg-black/60 border border-white/10 p-2.5 px-4 rounded-sm flex justify-between items-center mb-1">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-bold tracking-wider">{t('pvp.quota')}</span>
                    {pvpStats.count >= 5 && (
                      <button 
                        onClick={() => setPvpStats({ count: 0, lastResetDayId: -1 })}
                        className="text-[6px] text-red-500 hover:text-red-400 bg-red-500/10 px-1 py-0.5 border border-red-500/30 rounded-sm w-fit transition-colors whitespace-nowrap"
                      >
                        {t('pvp.resetQuota')}
                      </button>
                    )}
                  </div>
                  <span className="text-[8px] text-gray-500 italic">{t('pvp.resetEvery2h')}</span>
                </div>
                <div className={`text-lg font-black italic tracking-tighter ${pvpStats.count >= 5 ? 'text-red-500 animate-pulse' : 'text-[#f1c40f]'}`}>
                  {5 - pvpStats.count} / 5 <span className="text-[8px] uppercase not-italic text-gray-400 ml-1">{t('pvp.rounds')}</span>
                </div>
              </div>

              {/* 1 VS 1 Card */}
              <PvpModeCard 
                title="1 VS 1"
                heroes={selected1v1.map(i => userHeroes[i]).filter(Boolean)}
                reward="1.8"
                fee={PVP_MODES.DUEL_1V1.fee}
                onAction={() => startMatchmaking('1v1')}
                isReady={selected1v1.length === 1}
                disabled={pvpStats.count >= 5}
              />

              {/* 3 VS 3 Card */}
              <PvpModeCard 
                title="3 VS 3"
                heroes={selected3v3.map(i => userHeroes[i]).filter(Boolean)}
                reward="5.5" 
                fee={PVP_MODES.TEAM_3V3.fee}
                onAction={() => startMatchmaking('3v3')}
                isReady={selected3v3.length === 3}
                disabled={pvpStats.count >= 5}
              />
            </div>
         </div>
         <div className="h-6 w-full" />
      </div>
    );
  }

  function PvpModeCard({ title, heroes, reward, fee, onAction, isReady, disabled }) {
    const totalAtk = heroes.reduce((acc, h) => acc + (h.atk || 0), 0);
    const count = title.includes('1') ? 1 : 3;

    return (
      <div className="relative bg-[#1a1c23]/95 border-[2px] border-[#2c303c] p-4 pvp-card-glow overflow-hidden rounded-md">
        {/* Sunburst Header BG */}
        <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 w-48 h-48 pvp-sunburst-bg opacity-30"></div>
        
        <div className="relative z-10 flex flex-col items-center">
           {/* Header Title */}
           <h3 className="text-xl font-black text-[#f39c12] italic tracking-tighter text-stroke-pvp mb-3 scale-y-110">
             {title}
           </h3>

           {/* Battle Preview: Player vs Opponent */}
           <div className="flex items-center justify-between w-full gap-1 mb-4 px-1">
              {/* Player Side */}
              <div className="flex gap-0.5 justify-end flex-1">
                {Array.from({ length: count }).map((_, i) => {
                  const hero = heroes[i];
                  const boxSize = count === 1 ? 'w-14 h-14' : 'w-9 h-9';
                  return (
                    <div 
                      key={`player-${i}`}
                      className={`${boxSize} border-2 flex items-center justify-center bg-black/40 relative overflow-hidden`}
                      style={{ 
                        borderColor: hero ? hero.color : 'rgba(255,255,255,0.1)',
                        backgroundColor: hero ? `${hero.color}11` : 'transparent' 
                      }}
                    >
                      {hero ? (
                        <div className="w-full h-full p-0.5"><HeroSprite char={hero} /></div>
                      ) : (
                        <div className="text-[8px] text-gray-700 font-bold">...</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center mx-0.5">
                <span className="text-red-500 font-black italic text-lg drop-shadow-lg scale-110">VS</span>
              </div>

              {/* Opponent Side (Silhouettes) */}
              <div className="flex gap-0.5 justify-start flex-1">
                {Array.from({ length: count }).map((_, i) => {
                  const boxSize = count === 1 ? 'w-14 h-14' : 'w-9 h-9';
                  return (
                    <div key={`opp-${i}`} className={`${boxSize} border border-gray-800 flex items-center justify-center bg-black/60 relative overflow-hidden grayscale opacity-60`}>
                      <div style={{ filter: 'brightness(0)' }} className="w-full h-full p-0.5">
                        <HeroSprite char={CHARACTERS[0]} />
                      </div>
                    </div>
                  );
                })}
              </div>
           </div>

           {/* Stats Row */}
           <div className="flex gap-2 w-full mb-3">
              <div className="flex-1 bg-black/40 border border-[#f1c40f]/40 p-2.5 px-3 flex items-center justify-between rounded-sm">
                <span className="text-xs text-yellow-500 font-bold tracking-tight">REWARD</span>
                <span className="text-sm text-white font-black">{reward} <span className="text-[10px] text-gray-400">TON</span></span>
              </div>
              <div className="flex-1 bg-black/40 border border-[#9b59b6]/40 p-2.5 px-3 flex items-center justify-between rounded-sm">
                <span className="text-xs text-[#9b59b6] font-bold tracking-tight">SQUAD ATK</span>
                <span className="text-sm text-white font-black">{totalAtk}</span>
              </div>
           </div>

           {/* Interaction Button */}
           <button 
             onClick={!disabled ? onAction : null}
             disabled={disabled}
             className={`pixel-button w-full py-2 font-bold tracking-[0.15em] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_#1a1c23] flex items-center justify-center gap-3 transition-all ${disabled ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-80' : 'bg-[#2c303c] hover:bg-[#34495e] text-white animate-in slide-in-from-bottom-2'}`}
           >
             <span className="text-xl uppercase">{disabled ? 'LIMIT' : (isReady ? `${fee}` : 'CREATE')}</span>
             {!disabled && <img src="/ton_coin.png" alt="T" className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(0,152,234,0.7)]" />}
           </button>
        </div>
      </div>
    );
  }

  if (isPicking) {
    const limit = mode === '1v1' ? 1 : 3;
    return (
      <div className="flex flex-col flex-1 p-4 animate-in fade-in h-full overflow-hidden relative">
        <WatermarkBg />
        <div className="relative z-10 flex flex-col flex-1 h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[#f1c40f] text-lg font-bold">SELECT SQUAD ({selectedIndices.length}/{limit})</h2>
            <button onClick={() => setIsPicking(false)} className="text-[10px] text-gray-500 underline">Cancel</button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 mb-4 no-scrollbar flex flex-col gap-4">
            {(() => {
              const order = ['Legendary', 'Epic', 'SR', 'Rare', 'Common'];
              return order.map(rarity => {
                const groupHeroes = userHeroes
                  .map((hero, originalIdx) => ({ ...hero, originalIdx }))
                  .filter(h => h.rarity === rarity);
                
                if (groupHeroes.length === 0) return null;

                const rarityLabel = rarity === 'SR' ? 'SUPER RARE' : rarity.toUpperCase();
                const rarityColor = RARITY_COLORS?.[rarity] || '#888';

                return (
                  <div key={rarity} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                      <span className="text-[6px] font-bold tracking-widest px-2 py-0.5 border border-white/10 rounded-sm" 
                            style={{ color: rarityColor, borderColor: rarityColor + '44', backgroundColor: rarityColor + '11' }}>
                        {rarityLabel} ({groupHeroes.length})
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2">
                      {groupHeroes.map(({ originalIdx, ...hero }) => {
                        const isSelected = selectedIndices.includes(originalIdx);
                        return (
                          <button 
                            key={hero.instanceId}
                            onClick={() => toggleHero(originalIdx)}
                            onPointerDown={(e) => onLongPressStart?.(hero, e)}
                            onPointerUp={onLongPressEnd}
                            onPointerLeave={onLongPressEnd}
                            onPointerCancel={onLongPressEnd}
                            onContextMenu={(e) => e.preventDefault()}
                            className={`hero-card-picker relative p-1.5 pixel-border-sm flex flex-col items-center cursor-pointer transition-all select-none touch-none ${isSelected ? 'scale-105 ring-2 ring-yellow-400 bg-yellow-400/10' : 'bg-black/40 border-gray-700 opacity-90'}`}
                            style={{ borderColor: isSelected ? '#f1c40f' : hero.color }}
                          >
                            {/* Rarity Badge */}
                            <div className="absolute -top-1.5 right-0 px-1 text-[4px] bg-black/80 border border-gray-700 z-10" style={{ color: hero.color }}>
                              {hero.rarity === 'SR' ? 'S.Rare' : hero.rarity}
                            </div>
                            
                            {/* Selected Index Indicator */}
                            {isSelected && (
                              <div className="absolute -top-2.5 -right-2.5 bg-yellow-400 text-black text-[8px] w-5 h-5 flex items-center justify-center rounded-full z-20 font-black border-2 border-black italic shadow-lg">
                                {selectedIndices.indexOf(originalIdx) + 1}
                              </div>
                            )}

                            {/* Level Badge */}
                            <div className="absolute -top-1.5 left-0 px-1 text-[4px] bg-black/80 border border-gray-700 text-gray-400 z-10">
                              Lv.{hero.level || 1}
                            </div>

                            {/* Element Icon - Positioned below Level Badge */}
                            <div className="absolute top-2 left-0 w-3.5 h-3.5 bg-black/80 flex items-center justify-center rounded-sm text-[7px] z-10 border border-white/5">
                              {ELEMENT_ICONS[hero.element]}
                            </div>

                            {/* Sprite Area */}
                            <div className="w-12 h-12 flex items-center justify-center mb-1 relative" style={{backgroundColor: hero.imageColor}}>
                              <div className="w-10 h-10">
                                <HeroSprite char={hero} />
                              </div>
                            </div>

                            {/* Name */}
                            <div className="text-[5px] text-gray-400 truncate w-full text-center leading-tight mb-0.5">
                              {hero.name}
                            </div>

                            {/* Stats block */}
                            <div className="flex flex-col items-center w-full gap-[1px] text-[5px] font-bold leading-none mt-0.5">
                              <div className="flex gap-1">
                                <span className="text-red-400">HP:{hero.hp}</span>
                                <span className="text-orange-400">ATK:{hero.atk}</span>
                              </div>
                              <div className="flex gap-1">
                                <span className="text-blue-400">DEF:{hero.def}</span>
                                <span className="text-emerald-400">SPD:{hero.spd}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <button 
            onClick={confirmSelection}
            disabled={selectedIndices.length < limit}
            className={`pixel-button w-full py-4 text-sm font-bold border-4 ${selectedIndices.length < limit ? 'bg-gray-700 border-gray-600 text-gray-500' : 'bg-[#f1c40f] border-white text-black'}`}
          >
            {selectedIndices.length < limit ? `SELECT ${limit - selectedIndices.length} MORE` : 'NEXT STEP →'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'matchmaking') {
    return (
      <MatchmakingView 
        playerTeam={playerTeam}
        enemyTeam={enemyTeam}
        currentSettings={currentSettings}
        onConfirmFight={payAndFight}
        onBack={() => setView('lounge')}
        mode={mode}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full w-full relative overflow-hidden bg-[#0a0a0f]">
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30 image-pixelated pointer-events-none" style={{backgroundImage: "url('/pvp_bg.png')"}}></div>
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[rgba(10,20,30,0.8)] to-transparent z-0"></div>

      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between px-3 pt-3 text-[10px] font-bold">
        <div className="flex flex-col gap-1 items-start">
          <span className="text-blue-400 drop-shadow-md bg-black/60 px-2 py-0.5 pixel-border-sm">PLAYER TEAM</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-[#f1c40f] drop-shadow-md bg-black/80 px-4 py-1.5 pixel-border-sm border-[#f1c40f]">
             POOL: {currentSettings.pool} TON
          </div>
          <span className="text-[7px] text-gray-500 mt-1.5 px-2 py-0.5 bg-black/60 rounded-sm">Dev Fee: {currentSettings.devFee} TON</span>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className="text-red-400 drop-shadow-md bg-black/60 px-2 py-0.5 pixel-border-sm">ENEMY TEAM</span>
        </div>
      </div>

      <div className="flex-1 flex w-full relative z-10 pt-16 pb-24">
        <div className="flex-1 flex flex-col justify-center items-center gap-4">
           {playerTeam.map(p => (
             <BattleCharacter 
               key={p.battleId} 
               hero={p} 
               isLeft={true}
               animState={animState}
             />
           ))}
        </div>
        <div className="flex-1 flex flex-col justify-center items-center gap-4">
           {enemyTeam.map(e => (
             <BattleCharacter 
               key={e.battleId} 
               hero={e} 
               isLeft={false}
               animState={animState}
             />
           ))}
        </div>
      </div>

      {winner && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center animate-in fade-in">
           <h2 className={`text-3xl ${winner==='player'?'text-[#f1c40f]':'text-red-500'} font-black mb-2 tracking-tighter italic`}>
             {winner === 'player' ? 'VICTORY!' : 'DEFEAT'}
           </h2>
           {winner === 'player' && (
             <div className="flex flex-col items-center">
               <p className="text-white text-xs mb-1">Earned: {currentSettings.winnerPrize} TON</p>
               <span className="text-[8px] text-[#f1c40f]/60 animate-pulse">MATCH TRANSFERRED TO WALLET</span>
             </div>
           )}
           {winner === 'enemy' && <p className="text-white/60 text-[10px] mb-6">Better luck next time, pilot.</p>}
           <button onClick={() => setView('lounge')} className="pixel-button bg-gray-800 text-white px-6 py-2 pixel-border-sm">Return to Lounge</button>
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 z-20 bg-black/80 border border-green-900/50 p-2 h-20 overflow-hidden text-[8px] font-mono text-green-400 image-pixelated">
        <div className="flex flex-col gap-0.5 opacity-90">
          {battleLogs.map((log, idx) => (
            <div key={idx} style={{ opacity: 1 - (idx * 0.2) }}>&gt; {log}</div>
          ))}
          {battleLogs.length === 0 && <div>&gt; Waiting for next action...</div>}
        </div>
      </div>
    </div>
  );
}

const BattleCharacter = ({ hero, isLeft, animState }) => {
  const isDead = hero.currentHp <= 0;
  
  const isSimultaneousAttacker = animState.isSimultaneous && !isDead;
  const isNormalAttacker = animState.attackerId === hero.battleId;
  const isAttacking = isNormalAttacker || isSimultaneousAttacker;
  
  const isTarget = animState.targetId === hero.battleId;

  let animationClass = '';
  if (isAttacking) {
     const dashClass = isLeft ? 'anim-melee-dash' : 'anim-melee-dash-reverse';
     if (hero.attackType === 'melee') animationClass = dashClass;
  } else if (isTarget && animState.type) {
     if (animState.isHit) {
        animationClass = isLeft ? 'anim-knockback-reverse' : 'anim-knockback'; 
     } else {
        animationClass = isLeft ? 'anim-dodge-reverse' : 'anim-dodge';
     }
  }

  if (isDead) animationClass = 'anim-death';

  return (
    <div className="relative flex flex-col items-center">
      {!isDead && (
        <div className="w-12 h-2.5 bg-red-900 mb-1 border border-black overflow-hidden z-20 relative">
          <div className="h-full bg-green-500 transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" style={{width: `${(hero.currentHp/hero.maxHp)*100}%`}}></div>
          <div className="absolute inset-0 flex items-center justify-center text-[5px] font-black text-white leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] px-0.5 whitespace-nowrap">
            {Math.ceil(hero.currentHp).toLocaleString()} / {hero.maxHp.toLocaleString()}
          </div>
        </div>
      )}
      
      <div 
        className={`w-14 h-14 p-1 pixel-border-sm transition-opacity duration-[800ms] ${animationClass}`}
        style={{ 
          backgroundColor: hero.imageColor, 
          borderColor: hero.color,
          transform: isLeft ? 'scaleX(1)' : 'scaleX(-1)' 
        }}
      >
        <HeroSprite char={hero} />
        
        {isTarget && animState.isHit && (
          <div className="anim-explosion inset-0 w-full h-full text-3xl flex items-center justify-center pointer-events-none relative">
            <span className="z-50 scale-[2.0] drop-shadow-[0_0_15px_rgba(255,165,0,0.8)]">💥</span>
            <span className="absolute text-[12px] -translate-x-6 -translate-y-6 animate-ping opacity-70">🔥</span>
            <span className="absolute text-[12px] translate-x-6 translate-y-6 animate-ping opacity-70">🔥</span>
            <span className="absolute text-[10px] -translate-x-8 translate-y-4 animate-bounce opacity-50">💨</span>
            <span className="absolute text-[10px] translate-x-8 -translate-y-4 animate-bounce opacity-50">💨</span>
          </div>
        )}
        
        {animState.isSimultaneous && isAttacking && !isDead && (
          <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none"></div>
        )}
        
        {isTarget && !animState.isHit && animState.type && (
          <div 
            className="absolute -top-6 left-0 w-full text-center text-[10px] text-yellow-400 font-black animate-bounce drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" 
            style={{transform: isLeft ? 'scaleX(1)' : 'scaleX(-1)'}}
          >
            {animState.type === 'melee-dash' ? 'MISS!' : 'DODGE!'}
          </div>
        )}
      </div>

      {(isAttacking && hero.attackType === 'ranged') && (
        <div 
          className={`absolute top-4 ${isLeft?'left-12 anim-projectile-fire':'right-12 anim-projectile-fire-reverse'} w-4 h-1 bg-yellow-300 rounded-full z-50`} 
          style={{boxShadow: '0 0 12px #ffff00', filter: 'brightness(1.5)'}} 
        />
      )}
    </div>
  );
};

// ====================================================================
// Matchmaking View — Full Flow with Searching, Found, Timeout
// ====================================================================
const MatchmakingView = ({ playerTeam, enemyTeam, currentSettings, onConfirmFight, onBack, mode }) => {
  const { t } = useT();
  const [matchStatus, setMatchStatus] = useState('confirm');
  const [countdown, setCountdown] = useState(60);
  const [showRules, setShowRules] = useState(false);

  const startSearching = () => {
    setMatchStatus('searching');
    setCountdown(60);
  };

  const handleRefund = () => {
    console.log("คืนเงิน TON กลับสู่กระเป๋าผู้เล่น...");
  };

  const cancelMatchmaking = () => {
    setMatchStatus('confirm');
    handleRefund();
  };

  useEffect(() => {
    let timer;
    let fakeBackendMatch;

    if (matchStatus === 'searching') {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setMatchStatus('timeout');
            handleRefund();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Simulated backend match (3-10s). Remove when connecting real API.
      const randomFindTime = Math.floor(Math.random() * 8000) + 3000;
      fakeBackendMatch = setTimeout(() => {
        clearInterval(timer);
        setMatchStatus('found');
        setTimeout(() => onConfirmFight(), 2000);
      }, randomFindTime);

      return () => {
        clearInterval(timer);
        clearTimeout(fakeBackendMatch);
      };
    }
  }, [matchStatus, onConfirmFight]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (countdown / 60) * circumference;

  return (
    <div className="flex flex-col items-center flex-1 p-4 animate-in fade-in relative min-h-full">
      <WatermarkBg />
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">

        {/* ───── CONFIRM SCREEN ───── */}
        {matchStatus === 'confirm' && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <h2 className="text-[#f1c40f] text-xl font-black mb-5 tracking-[0.15em] drop-shadow-[0_2px_8px_rgba(241,196,15,0.4)] italic flex items-center gap-2">
              CONFIRM MATCH
              <button 
                onClick={() => setShowRules(true)} 
                className="w-5 h-5 bg-[#2c303c] border border-gray-600 rounded-sm text-[10px] flex items-center justify-center hover:bg-gray-700 transition-colors not-italic"
                title="Read Rules"
              >?</button>
            </h2>

            <div className="w-full bg-[#0f111a]/90 border-2 border-[#2c303c] p-4 mb-5 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold tracking-wide">ENTRY FEE</span>
                <span className="text-blue-300 font-mono font-bold">{currentSettings.fee} <span className="text-[10px] text-gray-500">TON</span></span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-gray-800 pb-2.5">
                <span className="text-gray-400 font-bold tracking-wide">PRIZE POOL</span>
                <span className="text-[#f1c40f] font-mono font-bold">{currentSettings.pool} <span className="text-[10px] text-gray-500">TON</span></span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-red-500 font-bold tracking-wide">DEV FEE (10%)</span>
                <span className="text-red-500 font-mono font-bold">-{currentSettings.devFee} <span className="text-[10px] text-gray-500">TON</span></span>
              </div>
            </div>

            <div className="flex w-full justify-between items-center bg-[#0f111a]/80 border-2 border-[#2c303c] p-4 mb-6 relative">
              <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/10 -translate-x-1/2"></div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-blue-400 text-[10px] mb-2 font-black tracking-widest">PLAYER</span>
                <div className="flex gap-1">
                  {playerTeam.map(h => (
                    <div key={h.battleId} className="w-10 h-10 overflow-hidden border-2 border-gray-700 hover:border-blue-400 transition-all" style={{backgroundColor: h.imageColor}}>
                      <HeroSprite char={h} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-black/90 rounded-full border-2 border-red-500/40 z-10 mx-2 shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                <span className="text-red-500 font-black italic text-base">VS</span>
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-red-400 text-[10px] mb-2 font-black tracking-widest">OPPONENT</span>
                <div className="flex gap-1">
                  {enemyTeam.map(h => (
                    <div key={h.battleId} className="w-10 h-10 overflow-hidden border-2 border-gray-700 grayscale opacity-60" style={{backgroundColor: h.imageColor}}>
                      <HeroSprite char={h} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={startSearching}
              className="pixel-button w-full py-4 bg-[#f1c40f] hover:bg-[#f39c12] text-black text-sm font-black border-4 border-white shadow-[0_0_20px_rgba(241,196,15,0.4)] tracking-[0.15em] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('pvp.confirmAndFight')}
            </button>

            {/* Rules Tooltip */}
            <div className="mt-4 w-full bg-gray-800 bg-opacity-80 p-2.5 pixel-border-sm flex items-center gap-2 shadow-lg">
              <span className="text-sm">⚠️</span>
              <p className="text-[9px] text-gray-300 font-bold leading-tight tracking-tight">
                {mode === '3v3' 
                  ? t('pvp.quickRule3v3')
                  : t('pvp.quickRule1v1')}
              </p>
            </div>

            <button onClick={onBack} className="mt-4 text-[10px] text-gray-500 hover:text-white transition-colors underline tracking-wider">
              {t('pvp.backToLounge')}
            </button>
          </div>
        )}

        {/* ───── SEARCHING SCREEN ───── */}
        {matchStatus === 'searching' && (
          <div className="w-full flex flex-col items-center justify-center animate-in fade-in duration-300 py-8">
            <h2 className="text-2xl font-black text-blue-400 animate-pulse tracking-[0.1em] mb-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              SEARCHING...
            </h2>
            <p className="text-gray-500 text-[10px] mb-8 tracking-wider font-bold">
              {t('pvp.searchingPlayers')}
            </p>

            <div className="relative w-32 h-32 flex items-center justify-center mb-8">
              <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle 
                  cx="60" cy="60" r={radius} fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth="6" 
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="text-4xl font-black text-white drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] relative z-10">
                {countdown}
              </span>
            </div>

            <div className="flex gap-2 mb-8">
              {playerTeam.map(h => (
                <div key={h.battleId} className="w-10 h-10 border-2 border-blue-500/40 overflow-hidden animate-pulse" style={{backgroundColor: h.imageColor}}>
                  <HeroSprite char={h} />
                </div>
              ))}
            </div>

            <button 
              onClick={cancelMatchmaking}
              className="text-red-400 hover:text-red-300 underline text-[10px] font-bold tracking-wider transition-colors"
            >
              {t('pvp.cancelSearch')} ({t('pvp.refund')} {currentSettings.fee} TON)
            </button>
          </div>
        )}

        {/* ───── MATCH FOUND SCREEN ───── */}
        {matchStatus === 'found' && (
          <div className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300 py-12">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse"></div>
              <h2 className="text-3xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)] tracking-[0.15em] relative z-10 mb-3">
                MATCH FOUND!
              </h2>
            </div>
            <p className="text-white/80 text-xs font-bold tracking-wider animate-pulse">
              <span className="text-gray-500 text-[8px] font-bold uppercase tracking-[0.2em] animate-pulse">⏰ Reset every 2 hrs</span> เตรียมตัวเข้าสู่สมรภูมิ...
            </p>

            <div className="flex items-center gap-4 mt-8">
              <div className="flex gap-1">
                {playerTeam.map(h => (
                  <div key={h.battleId} className="w-12 h-12 border-2 border-blue-400 overflow-hidden shadow-[0_0_10px_rgba(59,130,246,0.3)]" style={{backgroundColor: h.imageColor}}>
                    <HeroSprite char={h} />
                  </div>
                ))}
              </div>
              <span className="text-red-500 text-2xl font-black italic drop-shadow-lg animate-bounce">VS</span>
              <div className="flex gap-1">
                {enemyTeam.map(h => (
                  <div key={h.battleId} className="w-12 h-12 border-2 border-red-400 overflow-hidden shadow-[0_0_10px_rgba(239,68,68,0.3)]" style={{backgroundColor: h.imageColor}}>
                    <HeroSprite char={h} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ───── TIMEOUT SCREEN ───── */}
        {matchStatus === 'timeout' && (
          <div className="w-full flex flex-col items-center justify-center animate-in fade-in duration-300 py-12">
            <h2 className="text-2xl font-black text-gray-400 tracking-[0.1em] mb-3">TIMEOUT</h2>
            <p className="text-center text-gray-400 text-xs leading-relaxed mb-2 font-bold">
              ไม่พบผู้เล่นในขณะนี้
            </p>
            
            <div className="bg-[#0f111a]/90 border-2 border-[#2ecc71]/40 px-5 py-3 mb-8 flex items-center gap-3">
              <span className="text-lg">💸</span>
              <div>
                <p className="text-[#2ecc71] text-[10px] font-black tracking-widest">REFUND PROCESSED</p>
                <p className="text-white text-xs font-mono font-bold">{currentSettings.fee} TON → {t('pvp.yourWallet')}</p>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button 
                onClick={onBack}
                className="flex-1 pixel-button bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 text-[10px] font-bold tracking-wider border-2 border-gray-700 transition-colors"
              >
                {t('pvp.backToHome')}
              </button>
              <button 
                onClick={() => setMatchStatus('confirm')}
                className="flex-1 pixel-button bg-[#f1c40f] hover:bg-[#f39c12] text-black py-3 text-[10px] font-black tracking-wider border-2 border-white transition-all"
              >
                {t('pvp.searchAgain')}
              </button>
            </div>
          </div>
        )}

        {/* Rules Modal Overlay */}
        {showRules && (
          <PvpRulesModal mode={mode} onClose={() => setShowRules(false)} />
        )}

      </div>
    </div>
  );
};

// ====================================================================
// PVP Rules Modal — Pixel Art Styled Header & Bullet Points
// ====================================================================
const PvpRulesModal = ({ mode, onClose }) => {
  const is3v3 = mode === '3v3';
  const { t } = useT();

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-gray-900 border-4 border-yellow-600 shadow-[0_0_30px_rgba(202,138,4,0.3)] p-6 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Red X Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 bg-red-600 border-2 border-red-800 text-white flex items-center justify-center font-bold pixel-border-sm hover:bg-red-500 transition-colors z-30 leading-none"
        >
          ✕
        </button>

        {/* Title */}
        <div className="text-center mb-6 relative">
          <h2 className="text-yellow-400 text-lg font-black italic tracking-widest drop-shadow-[0_2px_10px_rgba(250,204,21,0.5)]">
            {is3v3 ? t('pvp.rulesTitle3v3', { defaultValue: 'กติกาการต่อสู้ 3 VS 3' }) : t('pvp.rulesTitle1v1', { defaultValue: 'กติกาการต่อสู้ 1 VS 1' })}
          </h2>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent mt-2"></div>
        </div>

        {/* Rules Content */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center bg-yellow-500/10 rounded-sm text-lg">
              {is3v3 ? "🤝" : "💰"}
            </div>
            <div>
              <h3 className="text-yellow-500 text-[10px] font-black tracking-wider uppercase mb-1">
                {is3v3 ? t('pvp.rule1Title3v3') : t('pvp.rule1Title1v1', { defaultValue: 'เงื่อนไขการเข้าร่วม' })}
              </h3>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                {is3v3 ? t('pvp.rule1Desc3v3') : t('pvp.rule1Desc1v1')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center bg-blue-500/10 rounded-sm text-lg">
              {is3v3 ? "💥" : "⚔️"}
            </div>
            <div>
              <h3 className="text-blue-400 text-[10px] font-black tracking-wider uppercase mb-1">
                {is3v3 ? t('pvp.rule2Title3v3') : t('pvp.rule2Title1v1')}
              </h3>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                {is3v3 ? t('pvp.rule2Desc3v3') : t('pvp.rule2Desc1v1')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center bg-green-500/10 rounded-sm text-lg">
              {is3v3 ? "💰" : "🏆"}
            </div>
            <div>
              <h3 className="text-green-400 text-[10px] font-black tracking-wider uppercase mb-1">
                {is3v3 ? t('pvp.rule3Title3v3') : t('pvp.rule3Title1v1')}
              </h3>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                {is3v3 ? t('pvp.rule3Desc3v3') : t('pvp.rule3Desc1v1')}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center bg-red-500/10 rounded-sm text-lg">⚠️</div>
            <div>
              <h3 className="text-red-400 text-[10px] font-black tracking-wider uppercase mb-1">{t('pvp.rule4Title')}</h3>
              <p className="text-gray-300 text-[10px] leading-relaxed font-bold">
                {is3v3 ? t('pvp.rule4Desc3v3') : t('pvp.rule4Desc1v1')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Decoration */}
        <div className="mt-8 flex justify-center opacity-20 h-4 overflow-hidden gap-1">
          {[...Array(12)].map((_, i) => <div key={i} className="w-4 h-4 bg-yellow-400/40 rotate-45"></div>)}
        </div>
      </div>
    </div>
  );
};
