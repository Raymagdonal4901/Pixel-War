import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import { useT } from '../i18n/LanguageContext';

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

const DEV_FEE = 0.10; // 10%
const BET_AMOUNT = 1; // 1 TON per bet

const ELEMENT_ICONS = {
  'PLASMA': '🔥',
  'CRYO': '💧',
  'BIO': '🌿'
};

const ArcadeBetting = ({ pvpStats, setPvpStats }) => {
  const { t } = useT();
  // States: 'idle' | 'betting' | 'locking' | 'battle' | 'result'
  const [gameState, setGameState] = useState('idle');
  const [countdown, setCountdown] = useState(30);
  const [robots, setRobots] = useState({ red: null, blue: null });
  const [selectedBet, setSelectedBet] = useState(null); // 'red' | 'blue'
  const [winner, setWinner] = useState(null);
  const [battleFX, setBattleFX] = useState(null); // 'red-attack' | 'blue-attack'
  const [showResultModal, setShowResultModal] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Simulated pool & bets (fake other players)
  const [pool, setPool] = useState({ red: 0, blue: 0 });
  const [fakeBets, setFakeBets] = useState([]); // Simulated bet records like backend DB

  // Match History (persisted in session, seeded with mock data)
  const [matchHistory, setMatchHistory] = useState([
    { round: 98, winner: 'BLUE', payout: 8.5, totalPool: 42, timestamp: Date.now() - 300000 },
    { round: 99, winner: 'RED', payout: 1.2, totalPool: 55, timestamp: Date.now() - 240000 },
    { round: 100, winner: 'RED', payout: 1.4, totalPool: 38, timestamp: Date.now() - 180000 },
    { round: 101, winner: 'BLUE', payout: 3.1, totalPool: 61, timestamp: Date.now() - 120000 },
    { round: 102, winner: 'RED', payout: 1.1, totalPool: 47, timestamp: Date.now() - 60000 },
  ]);
  const [roundCounter, setRoundCounter] = useState(103);

  const limitReached = pvpStats.count >= 5;

  // Calculate multipliers
  const totalPool = pool.red + pool.blue;
  const poolAfterFee = totalPool * (1 - DEV_FEE);
  const redMultiplier = pool.red > 0 ? (poolAfterFee / pool.red) : 0;
  const blueMultiplier = pool.blue > 0 ? (poolAfterFee / pool.blue) : 0;
  const redPercent = totalPool > 0 ? Math.round((pool.red / totalPool) * 100) : 50;
  const bluePercent = totalPool > 0 ? 100 - redPercent : 50;

  // Calculate reward
  const reward = useMemo(() => {
    if (!winner || !selectedBet) return 0;
    if (selectedBet !== winner) return 0;
    const side = selectedBet === 'red' ? pool.red : pool.blue;
    if (side <= 0) return 0;
    return (poolAfterFee / side) * BET_AMOUNT;
  }, [winner, selectedBet, pool, poolAfterFee]);

  // Simulate other bettors joining during the countdown
  useEffect(() => {
    if (gameState !== 'betting') return;
    let betId = 100;
    const interval = setInterval(() => {
      const side = Math.random() > 0.45 ? 'red' : 'blue';
      const amount = [1, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)];
      const fakeUser = `Bot_${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 99)}`;
      
      setPool(prev => ({ ...prev, [side]: prev[side] + amount }));
      setFakeBets(prev => [...prev, { id: betId++, userId: fakeUser, side: side.toUpperCase(), amount }]);
    }, 800 + Math.random() * 1200);
    return () => clearInterval(interval);
  }, [gameState]);

  // Initialize a new round
  const startNewRound = () => {
    const all = CHARACTERS.filter(c => c.rarity !== 'Legendary' || Math.random() > 0.8);
    const baseRed = all[Math.floor(Math.random() * all.length)];
    const baseBlue = all[Math.floor(Math.random() * all.length)];
    
    const isRedAtkDominant = Math.random() > 0.5;
    const baseSpd = Math.floor(Math.random() * 40) + 30;

    const generateStats = (atkDominant) => {
      let atk = atkDominant ? (Math.floor(Math.random() * 20) + 60) : (Math.floor(Math.random() * 15) + 20);
      let def = atkDominant ? (Math.floor(Math.random() * 10) + 20) : (Math.floor(Math.random() * 20) + 50);
      let spd = baseSpd + (Math.floor(Math.random() * 3) - 1);
      atk += Math.floor(Math.random() * 5);
      def += Math.floor(Math.random() * 5);
      return { atk, def, spd };
    };

    setRobots({ 
      red: { ...baseRed, ...generateStats(isRedAtkDominant) }, 
      blue: { ...baseBlue, ...generateStats(!isRedAtkDominant) } 
    });
    setPool({ 
      red: Math.floor(Math.random() * 8) + 3, 
      blue: Math.floor(Math.random() * 8) + 3 
    });
    setFakeBets([]);
    setGameState('betting');
    setCountdown(30);
    setSelectedBet(null);
    setWinner(null);
    setBattleFX(null);
    setShowResultModal(false);
    setClaimed(false);
  };

  // === Backend-style: calculateAndDistributeRewards ===
  const calculateAndDistributeRewards = useCallback((matchResult) => {
    // Build full bets array (fake bots + real player)
    const allBets = [...fakeBets];
    if (selectedBet) {
      allBets.push({ id: 0, userId: 'Player1 (YOU)', side: selectedBet.toUpperCase(), amount: BET_AMOUNT });
    }

    let totalRedBets = 0;
    let totalBlueBets = 0;
    allBets.forEach(bet => {
      if (bet.side === 'RED') totalRedBets += bet.amount;
      if (bet.side === 'BLUE') totalBlueBets += bet.amount;
    });

    const totalPoolCalc = totalRedBets + totalBlueBets;
    const devFee = totalPoolCalc * DEV_FEE;
    const netPool = totalPoolCalc - devFee;

    console.log('\n======== MATCH RESULT ========');
    console.log(`Total Pool: ${totalPoolCalc} TON`);
    console.log(`💰 Dev receives: ${devFee.toFixed(2)} TON`);
    console.log(`Net Pool: ${netPool.toFixed(2)} TON`);

    const winSideStr = matchResult.toUpperCase();
    const winningTotal = winSideStr === 'RED' ? totalRedBets : totalBlueBets;

    if (winningTotal === 0) {
      console.log('No one bet on the winning side. Dev takes the remaining pool!');
      return;
    }

    const payoutMultiplier = netPool / winningTotal;
    console.log(`🏆 Winning Side: ${winSideStr} | Multiplier: ${payoutMultiplier.toFixed(3)}x`);

    const winners = allBets.filter(bet => bet.side === winSideStr);
    winners.forEach(w => {
      const r = w.amount * payoutMultiplier;
      console.log(`  ✅ ${w.userId} bet ${w.amount} TON -> Wins ${r.toFixed(3)} TON`);
    });

    const losers = allBets.filter(bet => bet.side !== winSideStr);
    losers.forEach(l => {
      console.log(`  ❌ ${l.userId} bet ${l.amount} TON -> LOST`);
    });
    console.log('==============================\n');
  }, [fakeBets, selectedBet]);

  const simulateBattle = useCallback(() => {
    const score = (r, opp) => {
      const elementMult = getElementalMultiplier(r.element, opp.element);
      return (r.atk * elementMult * 1.5) + (r.spd * 1.2) + (r.def * 1.0);
    };
    const redScore = score(robots.red, robots.blue);
    const blueScore = score(robots.blue, robots.red);
    const total = redScore + blueScore;
    
    let ticks = 0;
    const fxInterval = setInterval(() => {
      setBattleFX(ticks % 2 === 0 ? 'red-attack' : 'blue-attack');
      ticks++;
    }, 500);

    setTimeout(() => {
      clearInterval(fxInterval);
      setBattleFX(null);
      const winSide = Math.random() < (redScore / total) ? 'red' : 'blue';
      setWinner(winSide);
      setGameState('result');
      setShowResultModal(true);
      
      // Run backend-style reward calculation
      calculateAndDistributeRewards(winSide);

      // Record to match history
      setMatchHistory(prev => {
        const winPool = winSide === 'red' ? pool.red : pool.blue;
        const tp = pool.red + pool.blue;
        const payout = winPool > 0 ? ((tp * (1 - DEV_FEE)) / winPool) : 1;
        const entry = {
          round: roundCounter,
          winner: winSide.toUpperCase(),
          payout: parseFloat(payout.toFixed(1)),
          totalPool: tp,
          timestamp: Date.now(),
        };
        return [...prev, entry];
      });
      setRoundCounter(prev => prev + 1);
    }, 5000);
  }, [robots.red, robots.blue, calculateAndDistributeRewards, pool, roundCounter]);

  // Countdown Logic
  useEffect(() => {
    let timer;
    if ((gameState === 'betting' || gameState === 'locking') && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (gameState === 'locking' && countdown === 0) {
      setGameState('battle');
      simulateBattle();
    }
    
    // Switch to locking
    if (gameState === 'betting' && countdown <= 5) {
       setGameState('locking');
    }
    
    return () => clearInterval(timer);
  }, [gameState, countdown, simulateBattle]);

  const handleBet = (side) => {
    if (limitReached || selectedBet || gameState !== 'betting') return;
    setSelectedBet(side);
    setPvpStats(prev => ({ ...prev, count: Math.min(5, prev.count + 1) }));
    // Add player's bet to the pool
    setPool(prev => ({ ...prev, [side]: prev[side] + BET_AMOUNT }));
  };

  const handleClaim = () => {
    setClaimed(true);
    // In real app: call API to credit TON
    setTimeout(() => {
      setShowResultModal(false);
    }, 1000);
  };

  // Format countdown as MM:SS
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ========== DERIVED STATS ==========
  const last5 = matchHistory.slice(-5);
  const redWins = matchHistory.filter(m => m.winner === 'RED').length;
  const _blueWins = matchHistory.filter(m => m.winner === 'BLUE').length;
  const totalMatches = matchHistory.length;
  const redWinRate = totalMatches > 0 ? Math.round((redWins / totalMatches) * 100) : 50;
  const blueWinRate = totalMatches > 0 ? 100 - redWinRate : 50;
  const highestPayout = matchHistory.reduce((max, m) => m.payout > max.payout ? m : max, matchHistory[0]);
  const avgPool = totalMatches > 0 ? Math.round(matchHistory.reduce((sum, m) => sum + m.totalPool, 0) / totalMatches) : 0;

  // ========== STATISTICS PANEL ==========
  if (showStats) {
    return (
      <div className="flex-1 flex flex-col bg-[#0a0c10] border-4 border-gray-800 arcade-crt-container min-h-[400px] overflow-hidden">
        <div className="arcade-crt-overlay"></div>
        <div className="arcade-scanline"></div>
        
        {/* Stats Header */}
        <div className="p-3 border-b border-green-900/30 flex justify-between items-center z-20 relative bg-black/60">
          <h3 className="text-[#2ecc71] text-sm font-black tracking-[0.3em] uppercase drop-shadow-[0_0_8px_rgba(46,204,113,0.5)]">
            {t('stats.title')}
          </h3>
          <button 
            onClick={() => setShowStats(false)} 
            className="text-[8px] text-gray-500 hover:text-white transition-colors border border-gray-700 px-2 py-1 uppercase tracking-wider"
          >
            {t('stats.close')}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="p-3 grid grid-cols-3 gap-2 z-20 relative border-b border-green-900/20">
          <div className="bg-black/80 border border-green-900/30 p-2 text-center">
            <span className="text-[6px] text-gray-600 uppercase font-bold tracking-widest block">Win Rate (24h)</span>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="text-[10px] font-black text-red-500">{redWinRate}%</span>
              <span className="text-[6px] text-gray-600">vs</span>
              <span className="text-[10px] font-black text-blue-500">{blueWinRate}%</span>
            </div>
          </div>
          <div className="bg-black/80 border border-amber-900/30 p-2 text-center">
            <span className="text-[6px] text-gray-600 uppercase font-bold tracking-widest block">Highest Payout</span>
            <span className="text-[10px] font-black text-[#f1c40f] block mt-1">{highestPayout?.payout}x</span>
            <span className="text-[5px] text-gray-500">Round #{highestPayout?.round}</span>
          </div>
          <div className="bg-black/80 border border-green-900/30 p-2 text-center">
            <span className="text-[6px] text-gray-600 uppercase font-bold tracking-widest block">Avg Pool</span>
            <span className="text-[10px] font-black text-[#2ecc71] block mt-1">{avgPool} TON</span>
          </div>
        </div>

        {/* Match History Table */}
        <div className="flex-1 overflow-y-auto p-3 z-20 relative">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-1 mb-2 pb-1 border-b border-green-900/30">
            <span className="text-[6px] text-[#2ecc71] font-black uppercase tracking-wider">Round</span>
            <span className="text-[6px] text-[#2ecc71] font-black uppercase tracking-wider text-center">Winner</span>
            <span className="text-[6px] text-[#2ecc71] font-black uppercase tracking-wider text-center">Payout</span>
            <span className="text-[6px] text-[#2ecc71] font-black uppercase tracking-wider text-right">Pool</span>
          </div>
          {/* Table Rows */}
          {[...matchHistory].reverse().map((m, i) => (
            <div key={i} className={`grid grid-cols-4 gap-1 py-1.5 border-b border-white/5 ${i === 0 ? 'bg-white/5' : ''}`}>
              <span className="text-[8px] text-gray-400 font-mono font-bold">#{m.round}</span>
              <span className="text-center">
                <span className={`inline-block w-3 h-3 rounded-full ${m.winner === 'RED' ? 'bg-red-500 shadow-[0_0_6px_rgba(255,0,0,0.6)]' : 'bg-blue-500 shadow-[0_0_6px_rgba(0,100,255,0.6)]'}`}></span>
              </span>
              <span className={`text-[8px] font-mono font-black text-center ${m.payout >= 3 ? 'text-[#f1c40f]' : m.payout >= 2 ? 'text-[#2ecc71]' : 'text-gray-400'}`}>{m.payout}x</span>
              <span className="text-[8px] text-gray-400 font-mono text-right">{m.totalPool} TON</span>
            </div>
          ))}
        </div>

        {/* Hot Streak Bar */}
        <div className="p-3 border-t border-green-900/30 bg-black/60 z-20 relative">
          <div className="flex items-center justify-between">
            <span className="text-[7px] text-[#f1c40f] font-black uppercase tracking-[0.2em]">🔥 Hot Streak</span>
            <div className="flex gap-1.5">
              {last5.map((m, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[6px] font-black ${m.winner === 'RED' ? 'bg-red-600 border-red-400 text-white shadow-[0_0_6px_rgba(255,0,0,0.5)]' : 'bg-blue-600 border-blue-400 text-white shadow-[0_0_6px_rgba(0,100,255,0.5)]'}`}
                >
                  {m.winner === 'RED' ? 'R' : 'B'}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1 mt-2">
            <div className="h-1.5 bg-red-600 transition-all duration-300" style={{ width: `${redWinRate}%` }}></div>
            <div className="h-1.5 bg-blue-600 transition-all duration-300" style={{ width: `${blueWinRate}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  // ========== IDLE SCREEN ==========
  if (gameState === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black border-4 border-gray-800 arcade-crt-container min-h-[400px]">
        <div className="arcade-crt-overlay"></div>
        <div className="arcade-scanline"></div>
        <h2 className="text-[#f1c40f] text-3xl font-black italic tracking-[0.2em] mb-8 text-center drop-shadow-lg scale-y-125">
          ARCADE ARENA
        </h2>
        <button 
          onClick={startNewRound}
          disabled={limitReached}
          className={`pixel-button px-10 py-4 text-lg font-black tracking-widest transition-all ${limitReached ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-blue-600 border-white text-white animate-pulse shadow-[0_0_20px_rgba(37,99,235,0.4)]'}`}
        >
          {limitReached ? t('pvp.limitReached') : t('arcade.insertCoin')}
        </button>

        {/* Stats Button */}
        <button 
          onClick={() => setShowStats(true)}
          className="mt-4 text-[9px] text-[#2ecc71] border border-green-900/40 px-5 py-2 bg-black/80 hover:bg-green-950/30 transition-colors uppercase tracking-[0.2em] font-bold z-20"
        >
          {t('arcade.viewStats')}
        </button>

        {/* Mini Hot Streak on idle */}
        {matchHistory.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 z-20">
            <span className="text-[6px] text-gray-600 uppercase tracking-wider font-bold">{t('arcade.last5')}</span>
            {last5.map((m, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${m.winner === 'RED' ? 'bg-red-600 shadow-[0_0_4px_rgba(255,0,0,0.4)]' : 'bg-blue-600 shadow-[0_0_4px_rgba(0,100,255,0.4)]'}`}></div>
            ))}
          </div>
        )}

        {limitReached && (
          <div className="flex flex-col items-center mt-4 gap-3 z-20">
             <p className="text-red-500 text-[9px] font-bold uppercase tracking-[0.2em] animate-pulse">{t('arcade.resetEvery2h')}</p>
             <button 
               onClick={() => setPvpStats({ count: 0, lastResetDayId: -1 })}
               className="text-[7px] text-gray-400 border border-gray-600 px-3 py-1.5 rounded bg-black hover:bg-gray-800 hover:text-white transition-colors uppercase tracking-[0.2em]"
             >
               {t('arcade.devReset')}
             </button>
          </div>
        )}
      </div>
    );
  }

  // ========== MAIN GAME SCREEN ==========
  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden relative arcade-crt-container min-h-[500px]">
      <div className={gameState === 'locking' ? "arcade-crt-overlay-intense" : "arcade-crt-overlay"}></div>
      <div className="arcade-scanline"></div>

      {/* Header Bar */}
      <div className="p-2 px-3 flex justify-between items-center z-20 relative bg-black/60 border-b border-white/10">
        <div className="bg-black/80 px-2.5 py-1 border border-white/15">
          <span className="text-[6px] text-gray-500 block uppercase font-bold tracking-widest">{t('arcade.pvpQuota')}</span>
          <span className={`text-[10px] font-black ${pvpStats.count >= 5 ? 'text-red-500' : 'text-[#f1c40f]'}`}>
            {5 - pvpStats.count} / 5
          </span>
        </div>

        {/* Countdown Timer */}
        {(gameState === 'betting' || gameState === 'locking') && (
          <div className="flex flex-col items-center">
            <span className="text-[6px] text-gray-500 uppercase font-bold tracking-[0.3em]">{t('arcade.matchStartsIn')}</span>
            <span className={`text-2xl font-black italic tabular-nums ${gameState === 'locking' ? 'text-red-500 animate-pulse' : 'text-[#f1c40f]'}`}>
              {formatTime(countdown)}
            </span>
          </div>
        )}
        {gameState === 'battle' && (
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_#f00]"></div>
            <span className="text-[10px] text-white font-black tracking-[0.2em] italic uppercase">{t('arcade.battle')}</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_6px_#00f]"></div>
          </div>
        )}
        {gameState === 'result' && (
          <span className="text-[10px] text-[#f1c40f] font-black tracking-[0.2em] uppercase">{t('arcade.matchOver')}</span>
        )}

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[6px] text-gray-600 font-bold uppercase tracking-wider">{t('arcade.devFee')}</span>
          <button onClick={() => setGameState('idle')} className="text-[7px] text-gray-500 hover:text-white transition-colors underline">{t('arcade.exit')}</button>
        </div>
      </div>

      {/* Prize Pool Distribution Bar */}
      {totalPool > 0 && (
        <div className="px-3 py-2 bg-black/40 border-b border-white/5 z-20 relative">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-black text-red-500 tracking-wider">
              RED: {pool.red} {t('common.ton')}
            </span>
            <span className="text-[6px] text-gray-500 font-bold uppercase tracking-widest">{t('arcade.prizePool')}</span>
            <span className="text-[8px] font-black text-blue-500 tracking-wider">
              BLUE: {pool.blue} {t('common.ton')}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-900 border border-white/10 flex overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-500 relative"
              style={{ width: `${redPercent}%` }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[6px] font-black text-white drop-shadow-md">
                {redPercent}%
              </span>
            </div>
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500 relative"
              style={{ width: `${bluePercent}%` }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[6px] font-black text-white drop-shadow-md">
                {bluePercent}%
              </span>
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[6px] text-gray-400 font-mono">
              {t('arcade.total')}: {totalPool} {t('common.ton')}
            </span>
            <span className="text-[6px] text-[#f1c40f] font-mono">
              {t('arcade.payout')}: {poolAfterFee.toFixed(1)} {t('common.ton')}
            </span>
          </div>
        </div>
      )}

      {/* Split Screen Battle Area */}
      <div className="flex-1 flex relative">
        {/* Center Overlay (Battle & Locking text) */}
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          {gameState === 'locking' && (
            <div className="bg-black/90 px-6 py-4 border-y-4 border-red-600 animate-pulse w-full text-center shadow-[0_0_40px_rgba(255,0,0,0.4)] backdrop-blur-sm">
               <span className="text-xl font-black text-red-500 italic tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">{t('arcade.bettingClosed')}</span>
               <p className="text-[9px] text-white tracking-[0.5em] uppercase mt-2 opacity-80">{t('arcade.preparingBattle')}</p>
            </div>
          )}
          {gameState === 'battle' && (
            <div className="w-20 h-20 rounded-full border-2 border-yellow-500/30 flex items-center justify-center bg-black/50 backdrop-blur-sm shadow-[0_0_30px_rgba(241,196,15,0.15)]">
               <span className="text-3xl drop-shadow-lg">⚔️</span>
            </div>
          )}
        </div>

        {/* RED SIDE */}
        <div className={`flex-1 flex flex-col items-center justify-center p-3 transition-colors duration-500 ${winner === 'red' ? 'bg-red-900/20' : 'bg-red-950/10'} border-r-2 border-white/5`}>
          <div className={`w-24 h-24 mb-3 relative ${winner === 'red' ? 'battle-glow-win' : ''} ${battleFX === 'red-attack' ? 'anim-attack-right' : ''} ${battleFX === 'blue-attack' ? 'anim-hit' : ''} ${gameState === 'locking' ? 'anim-power-up' : ''}`}>
             <div className="absolute inset-0 bg-red-600/10 blur-2xl rounded-full"></div>
             {battleFX === 'blue-attack' && <span className="absolute -top-3 -right-3 text-3xl z-50 drop-shadow-lg">💥</span>}
             {battleFX === 'red-attack' && <span className="absolute -right-6 top-[30%] text-2xl z-50 drop-shadow-lg scale-x-[-1] animate-pulse">🔫</span>}
             {gameState === 'locking' && <span className="absolute -left-2 top-[10%] text-xl z-50 opacity-80 animate-ping">⚡</span>}
             <img src={robots.red?.imagePath} className={`w-full h-full object-contain image-pixelated drop-shadow-[0_0_15px_rgba(255,51,68,0.4)] ${winner === 'blue' && gameState === 'result' ? 'grayscale opacity-30 blur-[1px] rotate-[-45deg]' : ''}`} alt="Red Bot" />
          </div>
          <div className={`bg-black/80 border-2 p-2 w-full max-w-[110px] transition-all ${winner === 'red' ? 'neon-border-red scale-105' : 'border-red-900/40 opacity-80'}`}>
            <h4 className="text-red-500 text-[9px] font-black italic mb-1.5 tracking-widest">{t('arcade.redUnit')}</h4>
            <div className="space-y-0.5 text-[7px] font-mono font-black">
              <div className="flex justify-between"><span className="text-gray-500">ATK</span><span className="text-white">{robots.red?.atk}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">DEF</span><span className="text-white">{robots.red?.def}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SPD</span><span className="text-white">{robots.red?.spd}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">ELM</span><span className="text-sm">{ELEMENT_ICONS[robots.red?.element] || '🤖'}</span></div>
            </div>
          </div>
        </div>

        {/* BLUE SIDE */}
        <div className={`flex-1 flex flex-col items-center justify-center p-3 transition-colors duration-500 ${winner === 'blue' ? 'bg-blue-900/20' : 'bg-blue-950/10'}`}>
          <div className={`w-24 h-24 mb-3 relative ${winner === 'blue' ? 'battle-glow-win' : ''} ${battleFX === 'blue-attack' ? 'anim-attack-left' : ''} ${battleFX === 'red-attack' ? 'anim-hit' : ''} ${gameState === 'locking' ? 'anim-power-up' : ''}`}>
             <div className="absolute inset-0 bg-blue-600/10 blur-2xl rounded-full"></div>
             {battleFX === 'red-attack' && <span className="absolute -top-3 -left-3 text-3xl z-50 drop-shadow-lg scale-x-[-1]">💥</span>}
             {battleFX === 'blue-attack' && <span className="absolute -left-6 top-[30%] text-2xl z-50 drop-shadow-lg animate-pulse">🔫</span>}
             {gameState === 'locking' && <span className="absolute -right-2 top-[10%] text-xl z-50 opacity-80 animate-ping">⚡</span>}
             <img src={robots.blue?.imagePath} className={`w-full h-full object-contain image-pixelated drop-shadow-[0_0_15px_rgba(37,99,235,0.4)] ${winner === 'red' && gameState === 'result' ? 'grayscale opacity-30 blur-[1px] rotate-[45deg]' : ''}`} alt="Blue Bot" />
          </div>
          <div className={`bg-black/80 border-2 p-2 w-full max-w-[110px] transition-all ${winner === 'blue' ? 'neon-border-blue scale-105' : 'border-blue-900/40 opacity-80'}`}>
            <h4 className="text-blue-500 text-[9px] font-black italic mb-1.5 tracking-widest">{t('arcade.blueUnit')}</h4>
            <div className="space-y-0.5 text-[7px] font-mono font-black">
              <div className="flex justify-between"><span className="text-gray-500">ATK</span><span className="text-white">{robots.blue?.atk}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">DEF</span><span className="text-white">{robots.blue?.def}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SPD</span><span className="text-white">{robots.blue?.spd}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">ELM</span><span className="text-sm">{ELEMENT_ICONS[robots.blue?.element] || '🤖'}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Controls */}
      <div className="p-3 bg-gray-900/90 border-t-4 border-gray-800 z-20 relative">
         {(gameState === 'betting' || gameState === 'locking') ? (
           <div className="flex gap-3 relative">
              <button 
                onClick={() => handleBet('red')}
                disabled={selectedBet !== null || limitReached || gameState === 'locking'}
                className={`flex-1 py-3 border-4 transition-all font-black italic tracking-widest text-xs flex flex-col items-center gap-0.5 relative overflow-hidden ${selectedBet === 'red' ? 'bg-red-600 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : (gameState === 'locking' || selectedBet === 'blue' || limitReached ? 'bg-gray-800 border-gray-700 text-gray-500 shadow-none grayscale' : 'bg-[#1a0a0a] border-red-800 text-red-500 hover:border-red-500 hover:text-red-400 shadow-[0_4px_0_#990011]')}`}
              >
                <span>{t('arcade.betRed')} {gameState === 'locking' && <span className="ml-1 text-xs px-1">🔒</span>}</span>
                <span className="text-[8px] not-italic opacity-80">(1 {t('common.ton')})</span>
                <span className={`text-[7px] not-italic ${redMultiplier >= 2 ? 'text-[#2ecc71]' : 'text-gray-400'}`}>
                  {t('arcade.est')} {redMultiplier.toFixed(1)}x
                </span>
                {gameState === 'locking' && <div className="absolute inset-0 bg-black/40"></div>}
              </button>
              <button 
                onClick={() => handleBet('blue')}
                disabled={selectedBet !== null || limitReached || gameState === 'locking'}
                className={`flex-1 py-3 border-4 transition-all font-black italic tracking-widest text-xs flex flex-col items-center gap-0.5 relative overflow-hidden ${selectedBet === 'blue' ? 'bg-blue-600 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : (gameState === 'locking' || selectedBet === 'red' || limitReached ? 'bg-gray-800 border-gray-700 text-gray-500 shadow-none grayscale' : 'bg-[#0a0a1a] border-blue-800 text-blue-500 hover:border-blue-500 hover:text-blue-400 shadow-[0_4px_0_#001199]')}`}
              >
                <span>{t('arcade.betBlue')} {gameState === 'locking' && <span className="ml-1 text-xs px-1">🔒</span>}</span>
                <span className="text-[8px] not-italic opacity-80">(1 {t('common.ton')})</span>
                <span className={`text-[7px] not-italic ${blueMultiplier >= 2 ? 'text-[#2ecc71]' : 'text-gray-400'}`}>
                  {t('arcade.est')} {blueMultiplier.toFixed(1)}x
                </span>
                {gameState === 'locking' && <div className="absolute inset-0 bg-black/40"></div>}
              </button>
           </div>
         ) : (
           <div className="w-full py-3 flex items-center justify-center">
              {gameState === 'battle' && (
                <div className="flex items-center gap-3 animate-pulse">
                   <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_#f00]"></div>
                   <span className="text-white text-[10px] font-black tracking-[0.3em] italic uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{t('arcade.battleInProgress')}</span>
                   <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_#00f]"></div>
                </div>
              )}
              {gameState === 'result' && !showResultModal && (
                <button 
                  onClick={startNewRound}
                  className="pixel-button bg-[#f1c40f] text-black px-12 py-3 font-black text-xs tracking-[0.2em] border-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(241,196,15,0.3)]"
                >
                  {t('arcade.nextRound')}
                </button>
              )}
           </div>
         )}
      </div>

      {/* ========== MATCH RESULT MODAL ========== */}
      {showResultModal && winner && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-full max-w-[320px] bg-[#0a0c14] border-4 p-6 flex flex-col items-center relative overflow-hidden ${winner === 'red' ? 'border-red-600 shadow-[0_0_40px_rgba(255,51,68,0.3)]' : 'border-blue-600 shadow-[0_0_40px_rgba(59,130,246,0.3)]'}`}>
            
            {/* CRT effect inside modal */}
            <div className="arcade-crt-overlay rounded"></div>

            {/* Title */}
            <h3 className="text-[#f1c40f] text-sm font-black tracking-[0.3em] uppercase mb-4 drop-shadow-[0_0_10px_rgba(241,196,15,0.5)]">
              {t('arcade.matchResult')}
            </h3>

            {/* Trophy & Winner */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl drop-shadow-lg">🏆</span>
              <div className={`w-16 h-16 ${winner === 'red' ? 'drop-shadow-[0_0_20px_rgba(255,51,68,0.6)]' : 'drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]'}`}>
                <img 
                  src={winner === 'red' ? robots.red?.imagePath : robots.blue?.imagePath} 
                  className="w-full h-full object-contain image-pixelated" 
                  alt="Winner" 
                />
              </div>
            </div>
            
            <h4 className={`text-xl font-black italic tracking-widest mb-1 ${winner === 'red' ? 'neon-text-red' : 'neon-text-blue'}`}>
              {winner.toUpperCase()} {t('arcade.wins')}
            </h4>

            {/* Upset check */}
            {((winner === 'red' && redPercent < 40) || (winner === 'blue' && bluePercent < 40)) && (
              <span className="text-[#f1c40f] text-[8px] font-black tracking-[0.3em] uppercase animate-pulse mb-2">
                {t('arcade.upsetVictory')}
              </span>
            )}

            {/* Pool Summary */}
            <div className="w-full bg-black/60 border border-white/10 p-3 mb-4 space-y-1">
              <div className="flex justify-between text-[8px] font-mono">
                <span className="text-gray-500">{t('stats.poolLabel')}</span>
                <span className="text-white font-bold">{totalPool} {t('common.ton')}</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono">
                <span className="text-gray-500">{t('pvp.devFeeLabel')}</span>
                <span className="text-red-400 font-bold">-{(totalPool * DEV_FEE).toFixed(1)} {t('common.ton')}</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono border-t border-white/10 pt-1">
                <span className="text-gray-500">{t('stats.payoutLabel')}</span>
                <span className="text-[#f1c40f] font-bold">{poolAfterFee.toFixed(1)} {t('common.ton')}</span>
              </div>
            </div>

            {/* Reward */}
            {selectedBet ? (
              selectedBet === winner ? (
                <div className="w-full text-center mb-4">
                  <p className="text-[#2ecc71] text-sm font-black tracking-widest animate-pulse">
                    {t('arcade.youWon')} {reward.toFixed(2)} {t('common.ton')}
                  </p>
                  <p className="text-[7px] text-gray-500 mt-1">
                    ({(winner === 'red' ? redMultiplier : blueMultiplier).toFixed(1)}x multiplier applied)
                  </p>
                </div>
              ) : (
                <div className="w-full text-center mb-4">
                  <p className="text-red-500 text-sm font-black tracking-widest">
                    💀 {t('arcade.youLost')} 1 {t('common.ton')}
                  </p>
                  <p className="text-[7px] text-gray-500 mt-1">{t('pvp.betterLuck')}</p>
                </div>
              )
            ) : (
              <p className="text-gray-500 text-[8px] font-bold mb-4 uppercase tracking-wider">{t('arcade.didntBet')}</p>
            )}

            {/* Action Button */}
            {selectedBet && selectedBet === winner && !claimed ? (
              <button 
                onClick={handleClaim}
                className="w-full py-3.5 bg-[#f1c40f] text-black font-black text-sm tracking-[0.2em] uppercase hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(241,196,15,0.4)] border-b-4 border-yellow-700"
              >
                {t('raid.claim')}
              </button>
            ) : claimed ? (
              <div className="w-full py-3.5 bg-[#2ecc71] text-white font-black text-sm tracking-[0.2em] uppercase text-center">
                ✅ {t('modal.rewardClaimed')}
              </div>
            ) : (
              <button 
                onClick={() => setShowResultModal(false)}
                className="w-full py-3 bg-gray-800 text-gray-400 font-black text-xs tracking-[0.2em] uppercase hover:bg-gray-700 transition-colors border border-gray-700"
              >
                {t('stats.close').replace('✕ ', '')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcadeBetting;
