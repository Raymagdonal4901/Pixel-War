import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import { useT } from '../i18n/LanguageContext';

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const DEV_FEE = 0.10;
const BET_AMOUNT = 1;
const SEED_AMOUNT = 0.5; // Dev seed per side (0.5 TON each = 1.0 TON total)
const LOCK_COUNTDOWN = 5; // seconds for lock animation before battle
const ELEMENT_ICONS = { 'PLASMA': '🔥', 'CRYO': '💧', 'BIO': '🌿' };

function getElementalMultiplier(a, d) {
  if (a === 'PLASMA') { if (d === 'BIO') return 1.25; if (d === 'CRYO') return 0.80; }
  if (a === 'CRYO') { if (d === 'PLASMA') return 1.25; if (d === 'BIO') return 0.80; }
  if (a === 'BIO') { if (d === 'CRYO') return 1.25; if (d === 'PLASMA') return 0.80; }
  return 1.0;
}

function generateRobotPair() {
  const all = CHARACTERS.filter(c => c.rarity !== 'Legendary' || Math.random() > 0.8);
  const baseRed = all[Math.floor(Math.random() * all.length)];
  const baseBlue = all[Math.floor(Math.random() * all.length)];
  const isRedAtk = Math.random() > 0.5;
  const baseSpd = Math.floor(Math.random() * 40) + 30;
  const gen = (atk) => ({
    atk: atk ? Math.floor(Math.random()*20)+60 : Math.floor(Math.random()*15)+20,
    def: atk ? Math.floor(Math.random()*10)+20 : Math.floor(Math.random()*20)+50,
    spd: baseSpd + Math.floor(Math.random()*3)-1,
  });
  const rs = gen(isRedAtk); rs.atk += Math.floor(Math.random()*5); rs.def += Math.floor(Math.random()*5);
  const bs = gen(!isRedAtk); bs.atk += Math.floor(Math.random()*5); bs.def += Math.floor(Math.random()*5);
  return { red: { ...baseRed, ...rs }, blue: { ...baseBlue, ...bs } };
}

// ═══════════════════════════════════════════
// Real-time Match Round Calculator
// Every 2 hours = 1 round (00:00, 02:00, 04:00...)
// Lock betting 5 min before round end (XX:55)
// ═══════════════════════════════════════════
function getCurrentMatchRound(currentTime = new Date()) {
  const h = currentTime.getHours();
  const startHour = h % 2 === 0 ? h : h - 1;
  let nextHour = startHour + 2;
  if (nextHour >= 24) nextHour = 0;

  // Lock time = startHour+1 : 55 : 00
  const lockDate = new Date(currentTime);
  lockDate.setHours(startHour + 1, 55, 0, 0);
  const secondsUntilLock = Math.max(0, Math.floor((lockDate - currentTime) / 1000));
  const isLocked = secondsUntilLock === 0;

  return {
    startHour,
    roundStartText: `${String(startHour).padStart(2,'0')}:00`,
    roundEndText: `${String(nextHour).padStart(2,'0')}:00`,
    status: isLocked ? 'LOCKED' : 'LIVE',
    secondsUntilLock,
    upcomingRounds: [
      `${String(nextHour).padStart(2,'0')}:00`,
      `${String((nextHour + 2) % 24).padStart(2,'0')}:00`
    ]
  };
}

const formatTime = (s) => {
  if (s >= 3600) {
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};

// ═══════════════════════════════════════════
// Robot Stat Card (inline)
// ═══════════════════════════════════════════
const RobotCard = ({ robot, side, isWinner, isLoser }) => {
  const color = side === 'red' ? 'red' : 'blue';
  const borderClass = isWinner ? `neon-border-${color}` : `border-${color}-900/30`;
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className={`w-20 h-20 relative transition-all duration-300 ${isWinner ? 'battle-glow-win scale-105' : ''} ${isLoser ? 'grayscale opacity-30' : ''}`}>
        <div className={`absolute inset-0 bg-${color}-600/10 blur-xl rounded-full`}></div>
        <img src={robot?.imagePath} className="w-full h-full object-contain image-pixelated relative z-10" alt={side} style={isLoser ? {transform: side==='red'?'rotate(-30deg)':'rotate(30deg)'} : {}} />
      </div>
      <div className={`mt-2 bg-black/60 border p-2 w-full max-w-[100px] ${borderClass}`}>
        <h4 className={`text-${color}-500 text-[8px] font-black italic tracking-widest text-center mb-1`}>{side.toUpperCase()}</h4>
        <div className="space-y-0.5 text-[7px] font-mono font-bold">
          <div className="flex justify-between"><span className="text-gray-600">ATK</span><span className="text-white">{robot?.atk}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">DEF</span><span className="text-white">{robot?.def}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">SPD</span><span className="text-white">{robot?.spd}</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-600">ELM</span><span className="text-sm">{ELEMENT_ICONS[robot?.element]||'🤖'}</span></div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// Upcoming Match Card
// ═══════════════════════════════════════════
const UpcomingCard = ({ match }) => (
  <div className="relative rounded-lg overflow-hidden border border-gray-800/60 bg-[#0c0e14]/80 opacity-60" style={{filter:'brightness(0.8)'}}>
    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-600/30 to-transparent"></div>
    <div className="px-4 pt-3 pb-2 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">⏰ UPCOMING</span>
      </div>
      <span className="text-sm font-black text-gray-500 tabular-nums">{match.time}</span>
    </div>
    <div className="px-4 py-3 flex items-center justify-center gap-2">
      <div className="flex-1 flex flex-col items-center">
        <div className="w-14 h-14 relative opacity-70">
          <img src={match.robots.red?.imagePath} className="w-full h-full object-contain image-pixelated" alt="R" />
        </div>
        <div className="text-[6px] text-gray-600 font-mono font-bold mt-1 space-y-px text-center">
          <div>ATK:{match.robots.red?.atk} DEF:{match.robots.red?.def}</div>
          <div>SPD:{match.robots.red?.spd} {ELEMENT_ICONS[match.robots.red?.element]||'🤖'}</div>
        </div>
      </div>
      <span className="text-gray-700 font-black italic text-xs -mt-4">VS</span>
      <div className="flex-1 flex flex-col items-center">
        <div className="w-14 h-14 relative opacity-70">
          <img src={match.robots.blue?.imagePath} className="w-full h-full object-contain image-pixelated" alt="B" />
        </div>
        <div className="text-[6px] text-gray-600 font-mono font-bold mt-1 space-y-px text-center">
          <div>ATK:{match.robots.blue?.atk} DEF:{match.robots.blue?.def}</div>
          <div>SPD:{match.robots.blue?.spd} {ELEMENT_ICONS[match.robots.blue?.element]||'🤖'}</div>
        </div>
      </div>
    </div>
    <div className="px-4 pb-3 text-center">
      <span className="text-[7px] text-gray-700 font-bold uppercase tracking-[0.2em]">─── MATCH STARTS SOON ───</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
const ArcadeBetting = ({ pvpStats, setPvpStats }) => {
  const { t } = useT();
  const [gameState, setGameState] = useState('idle');
  const [matchInfo, setMatchInfo] = useState(() => getCurrentMatchRound());
  const [lockTimer, setLockTimer] = useState(LOCK_COUNTDOWN);
  const [currentRoundKey, setCurrentRoundKey] = useState(() => getCurrentMatchRound().startHour);
  const [robots, setRobots] = useState({ red: null, blue: null });
  const [selectedBet, setSelectedBet] = useState(null);
  const [winner, setWinner] = useState(null);
  const [battleFX, setBattleFX] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [pool, setPool] = useState({ red: 0, blue: 0 });
  const [fakeBets, setFakeBets] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [matchHistory, setMatchHistory] = useState([
    { round: 98, winner: 'BLUE', payout: 8.5, totalPool: 42, timestamp: Date.now()-300000 },
    { round: 99, winner: 'RED', payout: 1.2, totalPool: 55, timestamp: Date.now()-240000 },
    { round: 100, winner: 'RED', payout: 1.4, totalPool: 38, timestamp: Date.now()-180000 },
    { round: 101, winner: 'BLUE', payout: 3.1, totalPool: 61, timestamp: Date.now()-120000 },
    { round: 102, winner: 'RED', payout: 1.1, totalPool: 47, timestamp: Date.now()-60000 },
  ]);
  const [roundCounter, setRoundCounter] = useState(103);

  const limitReached = pvpStats.count >= 5;
  const totalPool = pool.red + pool.blue;
  const poolAfterFee = totalPool * (1 - DEV_FEE);
  const redMult = pool.red > 0 ? (poolAfterFee / pool.red) : 0;
  const blueMult = pool.blue > 0 ? (poolAfterFee / pool.blue) : 0;
  const redPct = totalPool > 0 ? Math.round((pool.red / totalPool) * 100) : 50;
  const bluePct = totalPool > 0 ? 100 - redPct : 50;

  const reward = useMemo(() => {
    if (!winner || !selectedBet || selectedBet !== winner) return 0;
    const side = selectedBet === 'red' ? pool.red : pool.blue;
    return side > 0 ? (poolAfterFee / side) * BET_AMOUNT : 0;
  }, [winner, selectedBet, pool, poolAfterFee]);

  // Initialize on mount
  useEffect(() => {
    const info = getCurrentMatchRound();
    setRobots(generateRobotPair());
    setPool({ red: SEED_AMOUNT, blue: SEED_AMOUNT });
    setUpcomingMatches([
      { robots: generateRobotPair(), time: info.upcomingRounds[0] },
      { robots: generateRobotPair(), time: info.upcomingRounds[1] },
    ]);
  }, []);

  // Real-time clock tick (every second)
  useEffect(() => {
    const interval = setInterval(() => setMatchInfo(getCurrentMatchRound()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-lock when real time runs out
  useEffect(() => {
    if (matchInfo.status === 'LOCKED' && (gameState === 'idle' || gameState === 'betting')) {
      setGameState('locking');
      setLockTimer(LOCK_COUNTDOWN);
    }
  }, [matchInfo.status, gameState]);

  // Auto-new-round when 2h window changes
  useEffect(() => {
    if (matchInfo.startHour !== currentRoundKey && (gameState === 'idle' || gameState === 'result')) {
      setCurrentRoundKey(matchInfo.startHour);
      const info = getCurrentMatchRound();
      setRobots(generateRobotPair());
      setPool({ red: SEED_AMOUNT, blue: SEED_AMOUNT });
      setUpcomingMatches([
        { robots: generateRobotPair(), time: info.upcomingRounds[0] },
        { robots: generateRobotPair(), time: info.upcomingRounds[1] },
      ]);
      setFakeBets([]); setGameState('idle');
      setSelectedBet(null); setWinner(null); setBattleFX(null);
      setShowResultModal(false); setClaimed(false);
    }
  }, [matchInfo.startHour, currentRoundKey, gameState]);

  // Fake bettors
  useEffect(() => {
    if (gameState !== 'betting') return;
    let betId = 100;
    const interval = setInterval(() => {
      const side = Math.random() > 0.45 ? 'red' : 'blue';
      const amount = [1,1,1,2,2,3][Math.floor(Math.random()*6)];
      const user = `Bot_${String.fromCharCode(65+Math.floor(Math.random()*26))}${Math.floor(Math.random()*99)}`;
      setPool(prev => ({ ...prev, [side]: prev[side]+amount }));
      setFakeBets(prev => [...prev, { id: betId++, userId: user, side: side.toUpperCase(), amount }]);
    }, 800 + Math.random()*1200);
    return () => clearInterval(interval);
  }, [gameState]);

  const calculateAndDistributeRewards = useCallback((matchResult) => {
    // Build bets array (bots + player, NOT including seed)
    const allBets = [...fakeBets];
    if (selectedBet) allBets.push({ id:0, userId:'Player1 (YOU)', side: selectedBet.toUpperCase(), amount: BET_AMOUNT });
    let tR=0, tB=0;
    allBets.forEach(b => { if(b.side==='RED') tR+=b.amount; if(b.side==='BLUE') tB+=b.amount; });
    // Total pool includes seed on both sides
    const totalR = tR + SEED_AMOUNT, totalB = tB + SEED_AMOUNT;
    const tp = totalR + totalB;
    const df = tp * DEV_FEE, np = tp - df;
    const ws = matchResult.toUpperCase();
    const wt = ws==='RED' ? totalR : totalB;
    if (wt===0) return;
    // If no real players bet at all, seed stays with Dev (no payout)
    if (tR===0 && tB===0) { console.log('No real bets — Seed 1.0 TON stays with Dev.'); return; }
    const pm = np/wt;
    console.log(`\n== MATCH RESULT == Pool:${tp} Dev:${df.toFixed(2)} Net:${np.toFixed(2)} Winner:${ws} Mult:${pm.toFixed(3)}x`);
    allBets.filter(b=>b.side===ws).forEach(w=>console.log(`  ✅ ${w.userId} ${w.amount}→${(w.amount*pm).toFixed(3)} TON`));
  }, [fakeBets, selectedBet]);

  const simulateBattle = useCallback(() => {
    const score = (r,o) => (r.atk * getElementalMultiplier(r.element,o.element) * 1.5)+(r.spd*1.2)+(r.def*1.0);
    const rS = score(robots.red, robots.blue), bS = score(robots.blue, robots.red), tot = rS+bS;
    let ticks = 0;
    const fxI = setInterval(() => { setBattleFX(ticks%2===0?'red-attack':'blue-attack'); ticks++; }, 500);
    setTimeout(() => {
      clearInterval(fxI); setBattleFX(null);
      const w = Math.random() < (rS/tot) ? 'red' : 'blue';
      setWinner(w); setGameState('result'); setShowResultModal(true);
      calculateAndDistributeRewards(w);
      setMatchHistory(prev => {
        const wp = w==='red'?pool.red:pool.blue, tp=pool.red+pool.blue;
        return [...prev, { round:roundCounter, winner:w.toUpperCase(), payout:parseFloat((wp>0?((tp*(1-DEV_FEE))/wp):1).toFixed(1)), totalPool:tp, timestamp:Date.now() }];
      });
      setRoundCounter(prev => prev+1);
    }, 5000);
  }, [robots.red, robots.blue, calculateAndDistributeRewards, pool, roundCounter]);

  // Lock countdown → battle
  useEffect(() => {
    let timer;
    if (gameState === 'locking' && lockTimer > 0) {
      timer = setInterval(() => setLockTimer(p => p - 1), 1000);
    } else if (gameState === 'locking' && lockTimer === 0) {
      setGameState('battle'); simulateBattle();
    }
    return () => clearInterval(timer);
  }, [gameState, lockTimer, simulateBattle]);

  const startNewRound = () => {
    let next;
    if (upcomingMatches.length > 0) {
      next = upcomingMatches[0].robots;
      setUpcomingMatches(prev => [...prev.slice(1), { robots: generateRobotPair(), time: `${String((parseInt(prev[prev.length-1]?.time) + 2) % 24).padStart(2,'0')}:00` }]);
    } else { next = generateRobotPair(); }
    setRobots(next);
    setPool({ red: SEED_AMOUNT, blue: SEED_AMOUNT });
    setFakeBets([]); setGameState('idle'); setLockTimer(LOCK_COUNTDOWN);
    setSelectedBet(null); setWinner(null); setBattleFX(null); setShowResultModal(false); setClaimed(false);
  };

  const handleBet = (side) => {
    if (gameState === 'idle') {
      setGameState('betting');
      setPvpStats(prev => ({ ...prev, count: Math.min(5,prev.count+1) }));
      setSelectedBet(side);
      setPool(prev => ({ ...prev, [side]: prev[side]+BET_AMOUNT }));
      return;
    }
    if (limitReached || selectedBet || gameState !== 'betting') return;
    setSelectedBet(side);
    setPvpStats(prev => ({ ...prev, count: Math.min(5,prev.count+1) }));
    setPool(prev => ({ ...prev, [side]: prev[side]+BET_AMOUNT }));
  };

  const handleClaim = () => { setClaimed(true); setTimeout(() => setShowResultModal(false), 1000); };

  // Stats
  const last5 = matchHistory.slice(-5);
  const redWins = matchHistory.filter(m=>m.winner==='RED').length;
  const totalM = matchHistory.length;
  const redWR = totalM>0 ? Math.round((redWins/totalM)*100) : 50;
  const blueWR = totalM>0 ? 100-redWR : 50;
  const highP = matchHistory.reduce((mx,m) => m.payout>mx.payout?m:mx, matchHistory[0]);
  const avgP = totalM>0 ? Math.round(matchHistory.reduce((s,m)=>s+m.totalPool,0)/totalM) : 0;

  // ═══════════ STATS PANEL ═══════════
  if (showStats) {
    return (
      <div className="flex-1 flex flex-col bg-[#0a0c10] border-4 border-gray-800 arcade-crt-container min-h-[400px] overflow-hidden">
        <div className="arcade-crt-overlay"></div><div className="arcade-scanline"></div>
        <div className="p-3 border-b border-green-900/30 flex justify-between items-center z-20 relative bg-black/60">
          <h3 className="text-[#2ecc71] text-sm font-black tracking-[0.3em] uppercase drop-shadow-[0_0_8px_rgba(46,204,113,0.5)]">{t('stats.title')}</h3>
          <button onClick={()=>setShowStats(false)} className="text-[8px] text-gray-500 hover:text-white transition-colors border border-gray-700 px-2 py-1 uppercase tracking-wider">{t('stats.close')}</button>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2 z-20 relative border-b border-green-900/20">
          <div className="bg-black/80 border border-green-900/30 p-2 text-center">
            <span className="text-[6px] text-gray-600 uppercase font-bold tracking-widest block">Win Rate</span>
            <div className="flex items-center justify-center gap-1 mt-1"><span className="text-[10px] font-black text-red-500">{redWR}%</span><span className="text-[6px] text-gray-600">vs</span><span className="text-[10px] font-black text-blue-500">{blueWR}%</span></div>
          </div>
          <div className="bg-black/80 border border-amber-900/30 p-2 text-center">
            <span className="text-[6px] text-gray-600 uppercase font-bold tracking-widest block">Highest</span>
            <span className="text-[10px] font-black text-[#f1c40f] block mt-1">{highP?.payout}x</span>
            <span className="text-[5px] text-gray-500">R#{highP?.round}</span>
          </div>
          <div className="bg-black/80 border border-green-900/30 p-2 text-center">
            <span className="text-[6px] text-gray-600 uppercase font-bold tracking-widest block">Avg Pool</span>
            <span className="text-[10px] font-black text-[#2ecc71] block mt-1">{avgP} TON</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 z-20 relative">
          <div className="grid grid-cols-4 gap-1 mb-2 pb-1 border-b border-green-900/30">
            {['Round','Winner','Payout','Pool'].map(h => <span key={h} className={`text-[6px] text-[#2ecc71] font-black uppercase tracking-wider ${h==='Pool'?'text-right':h==='Round'?'':'text-center'}`}>{h}</span>)}
          </div>
          {[...matchHistory].reverse().map((m,i) => (
            <div key={i} className={`grid grid-cols-4 gap-1 py-1.5 border-b border-white/5 ${i===0?'bg-white/5':''}`}>
              <span className="text-[8px] text-gray-400 font-mono font-bold">#{m.round}</span>
              <span className="text-center"><span className={`inline-block w-3 h-3 rounded-full ${m.winner==='RED'?'bg-red-500 shadow-[0_0_6px_rgba(255,0,0,0.6)]':'bg-blue-500 shadow-[0_0_6px_rgba(0,100,255,0.6)]'}`}></span></span>
              <span className={`text-[8px] font-mono font-black text-center ${m.payout>=3?'text-[#f1c40f]':m.payout>=2?'text-[#2ecc71]':'text-gray-400'}`}>{m.payout}x</span>
              <span className="text-[8px] text-gray-400 font-mono text-right">{m.totalPool} TON</span>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-green-900/30 bg-black/60 z-20 relative">
          <div className="flex items-center justify-between">
            <span className="text-[7px] text-[#f1c40f] font-black uppercase tracking-[0.2em]">🔥 Hot Streak</span>
            <div className="flex gap-1.5">{last5.map((m,i)=>(<div key={i} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[6px] font-black ${m.winner==='RED'?'bg-red-600 border-red-400 text-white shadow-[0_0_6px_rgba(255,0,0,0.5)]':'bg-blue-600 border-blue-400 text-white shadow-[0_0_6px_rgba(0,100,255,0.5)]'}`}>{m.winner==='RED'?'R':'B'}</div>))}</div>
          </div>
          <div className="flex gap-1 mt-2">
            <div className="h-1.5 bg-red-600 transition-all duration-300" style={{width:`${redWR}%`}}></div>
            <div className="h-1.5 bg-blue-600 transition-all duration-300" style={{width:`${blueWR}%`}}></div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ MAIN SCHEDULE VIEW ═══════════
  // Derived state flags
  const isBattle = gameState==='battle';
  const isResult = gameState==='result';

  return (
    <div className="flex-1 flex flex-col bg-[#080a10] overflow-hidden relative arcade-crt-container">
      <div className="arcade-crt-overlay"></div><div className="arcade-scanline"></div>

      <div className="flex-1 overflow-y-auto relative z-10 px-3 py-4 flex flex-col gap-4 no-scrollbar">
        {/* ═══ HEADER ═══ */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-[#f1c40f] text-lg font-black italic tracking-[0.15em] drop-shadow-lg">ARCADE ARENA</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[7px] text-gray-500 font-bold uppercase tracking-wider">ROUND #{roundCounter}</span>
              <span className="text-[7px] text-gray-600">|</span>
              <span className={`text-[7px] font-bold uppercase tracking-wider ${limitReached?'text-red-500':'text-gray-500'}`}>QUOTA {5-pvpStats.count}/5</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button onClick={()=>setShowStats(true)} className="text-[8px] text-[#2ecc71] border border-green-900/40 px-3 py-1.5 bg-black/80 hover:bg-green-950/30 transition-colors uppercase tracking-wider font-bold">
              📊 STATS
            </button>
            {limitReached && (
              <button onClick={()=>setPvpStats({count:0,lastResetDayId:-1})} className="text-[6px] text-red-500/80 border border-red-900/30 px-2 py-0.5 bg-black/60 hover:bg-red-950/20 transition-colors uppercase">
                {t('arcade.devReset')}
              </button>
            )}
          </div>
        </div>

        {/* Mini Streak */}
        {matchHistory.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[6px] text-gray-600 uppercase tracking-wider font-bold">{t('arcade.last5')}</span>
            {last5.map((m,i)=>(<div key={i} className={`w-3 h-3 rounded-full ${m.winner==='RED'?'bg-red-600 shadow-[0_0_4px_rgba(255,0,0,0.4)]':'bg-blue-600 shadow-[0_0_4px_rgba(0,100,255,0.4)]'}`}></div>))}
          </div>
        )}

        {/* ═══ LIVE MATCH CARD ═══ */}
        <div className={`relative rounded-lg overflow-hidden transition-all duration-500 ${
          isBattle ? 'ring-2 ring-yellow-500/50' : isResult ? (winner==='red'?'ring-2 ring-red-500/50':'ring-2 ring-blue-500/50') : 'ring-2 ring-cyan-500/30'
        }`} style={{
          background:'linear-gradient(180deg, #0f1520 0%, #0a0e18 100%)',
          boxShadow: isBattle ? '0 0 30px rgba(241,196,15,0.15)' : '0 0 30px rgba(0,200,255,0.08)',
        }}>
          {/* Neon top glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"></div>

          {/* Status Badge + Countdown */}
          <div className="px-4 pt-3 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isBattle?'bg-yellow-400 animate-pulse':isResult?'bg-gray-500':gameState==='locking'?'bg-red-500 animate-pulse':'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.6)]'
              }`}></div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                isBattle?'text-yellow-400':isResult?'text-gray-400':gameState==='locking'?'text-red-400':'text-red-400'
              }`}>
                {isBattle?'⚔️ BATTLE':isResult?'🏆 FINISHED':gameState==='locking'?'🔒 LOCKED':'🔴 LIVE'}
              </span>
            </div>
            {(gameState==='idle'||gameState==='betting') && matchInfo.secondsUntilLock > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[6px] text-gray-500 uppercase tracking-wider">CLOSES IN</span>
                <span className="text-lg font-black italic tabular-nums text-[#f1c40f]">{formatTime(matchInfo.secondsUntilLock)}</span>
                <span className="text-[5px] text-gray-600 tracking-wider">{matchInfo.roundStartText} — {matchInfo.roundEndText}</span>
              </div>
            )}
            {gameState==='locking' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[7px] text-gray-500 uppercase tracking-wider">LOCKING</span>
                <span className="text-lg font-black italic tabular-nums text-red-500 animate-pulse">{lockTimer}</span>
              </div>
            )}
            {gameState==='idle' && matchInfo.secondsUntilLock > 0 && <span className="text-[8px] text-cyan-400/60 font-bold uppercase tracking-wider animate-pulse">TAP TO BET ↓</span>}
            {isBattle && (
              <div className="flex items-center gap-1 animate-pulse">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span className="text-[7px] text-gray-400 italic uppercase tracking-wider">In Progress</span>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </div>

          {/* Locking Overlay */}
          {gameState==='locking' && (
            <div className="absolute inset-0 z-30 bg-black/60 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-6 py-4 border-y-4 border-red-600 animate-pulse w-full text-center">
                <span className="text-xl font-black text-red-500 italic tracking-[0.3em] uppercase">{t('arcade.bettingClosed')}</span>
                <p className="text-[9px] text-white tracking-[0.5em] uppercase mt-2 opacity-80">{t('arcade.preparingBattle')}</p>
              </div>
            </div>
          )}

          {/* Robot Display */}
          <div className="px-4 py-3 flex items-center justify-center gap-2 relative">
            {/* Battle FX overlays */}
            {battleFX==='blue-attack' && robots.red && <span className="absolute left-[20%] top-[20%] text-3xl z-50 drop-shadow-lg">💥</span>}
            {battleFX==='red-attack' && robots.blue && <span className="absolute right-[20%] top-[20%] text-3xl z-50 drop-shadow-lg scale-x-[-1]">💥</span>}

            <div className={`flex-1 flex flex-col items-center ${battleFX==='red-attack'?'anim-attack-right':''} ${battleFX==='blue-attack'?'anim-hit':''} ${gameState==='locking'?'anim-power-up':''}`}>
              <RobotCard robot={robots.red} side="red" isWinner={winner==='red'&&isResult} isLoser={winner==='blue'&&isResult} />
            </div>

            <div className="flex flex-col items-center -mt-8 z-20">
              {isBattle ? (
                <div className="w-12 h-12 rounded-full bg-black/90 border-2 border-yellow-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(241,196,15,0.2)]">
                  <span className="text-2xl">⚔️</span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-black/80 border-2 border-gray-700/50 flex items-center justify-center">
                  <span className="text-sm font-black italic text-gray-500">VS</span>
                </div>
              )}
            </div>

            <div className={`flex-1 flex flex-col items-center ${battleFX==='blue-attack'?'anim-attack-left':''} ${battleFX==='red-attack'?'anim-hit':''} ${gameState==='locking'?'anim-power-up':''}`}>
              <RobotCard robot={robots.blue} side="blue" isWinner={winner==='blue'&&isResult} isLoser={winner==='red'&&isResult} />
            </div>
          </div>

          {/* Pool Distribution Bar */}
          {totalPool > 0 && (
            <div className="px-4 py-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[7px] font-black text-red-500">RED: {pool.red} TON ({redPct}%)</span>
                <span className="text-[7px] font-black text-blue-500">BLUE: {pool.blue} TON ({bluePct}%)</span>
              </div>
              <div className="w-full h-3 bg-gray-900 border border-white/10 flex overflow-hidden rounded-sm">
                <div className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-500" style={{width:`${redPct}%`}}></div>
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500" style={{width:`${bluePct}%`}}></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[6px] text-gray-500 font-mono">TOTAL: {totalPool} TON</span>
                <span className="text-[6px] text-[#f1c40f] font-mono font-bold">PAYOUT: {poolAfterFee.toFixed(1)} TON</span>
              </div>
            </div>
          )}

          {/* Seed Pool Badge + Info */}
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-cyan-950/30 border border-cyan-800/30 px-2 py-1 rounded-sm">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-[7px] text-cyan-400 font-bold uppercase tracking-wider">SEED POOL: {SEED_AMOUNT * 2} TON ({SEED_AMOUNT}/side)</span>
            </div>
            <div className="group relative">
              <button className="w-4 h-4 bg-cyan-950/50 border border-cyan-800/30 rounded-full text-[7px] text-cyan-400 font-black flex items-center justify-center hover:bg-cyan-900/40 transition-colors">?</button>
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0a0e18] border border-cyan-800/40 p-2.5 rounded-md z-50 shadow-[0_0_20px_rgba(0,200,255,0.1)]">
                <p className="text-[7px] text-cyan-300 font-bold uppercase tracking-wider mb-1">🔒 Guaranteed Seed Pool</p>
                <p className="text-[6px] text-gray-400 leading-relaxed">ทุกแมตช์ ระบบจะวางเงินกองกลางเริ่มต้นฝั่งละ {SEED_AMOUNT} TON เพื่อรับประกันว่าผู้ชนะจะได้รับผลกำไรอย่างแน่นอน แม้จะไม่มีผู้เล่นฝั่งตรงข้ามร่วมเดิมพันก็ตาม</p>
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0e18] border-r border-b border-cyan-800/40 rotate-45"></div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 pb-4">
            {(gameState==='idle'||gameState==='betting') && !limitReached && (
              <div className="flex gap-2">
                <button onClick={()=>handleBet('red')} disabled={selectedBet!==null||(gameState==='betting'&&limitReached)}
                  className={`flex-1 py-3 border-2 font-black text-xs tracking-widest flex flex-col items-center gap-0.5 transition-all ${
                    selectedBet==='red'?'bg-red-600 border-white text-white shadow-[0_0_20px_rgba(255,0,0,0.3)] scale-[1.02]':
                    selectedBet==='blue'?'bg-gray-800 border-gray-700 text-gray-500 grayscale':
                    'bg-gradient-to-b from-red-700 to-red-900 border-red-500/50 text-white hover:from-red-600 hover:to-red-800 active:scale-[0.98] shadow-[0_0_15px_rgba(255,0,0,0.15)]'
                  }`}>
                  <span>🔴 BET RED</span>
                  <span className="text-[7px] font-normal opacity-70">(1 TON)</span>
                  {gameState==='betting' && <span className={`text-[6px] font-normal ${redMult>=2?'text-[#2ecc71]':'text-gray-400'}`}>Est. {redMult.toFixed(1)}x</span>}
                </button>
                <button onClick={()=>handleBet('blue')} disabled={selectedBet!==null||(gameState==='betting'&&limitReached)}
                  className={`flex-1 py-3 border-2 font-black text-xs tracking-widest flex flex-col items-center gap-0.5 transition-all ${
                    selectedBet==='blue'?'bg-blue-600 border-white text-white shadow-[0_0_20px_rgba(0,100,255,0.3)] scale-[1.02]':
                    selectedBet==='red'?'bg-gray-800 border-gray-700 text-gray-500 grayscale':
                    'bg-gradient-to-b from-blue-700 to-blue-900 border-blue-500/50 text-white hover:from-blue-600 hover:to-blue-800 active:scale-[0.98] shadow-[0_0_15px_rgba(0,100,255,0.15)]'
                  }`}>
                  <span>🔵 BET BLUE</span>
                  <span className="text-[7px] font-normal opacity-70">(1 TON)</span>
                  {gameState==='betting' && <span className={`text-[6px] font-normal ${blueMult>=2?'text-[#2ecc71]':'text-gray-400'}`}>Est. {blueMult.toFixed(1)}x</span>}
                </button>
              </div>
            )}
            {limitReached && gameState==='idle' && (
              <div className="text-center py-3">
                <p className="text-red-500 text-[9px] font-bold uppercase tracking-[0.2em] animate-pulse">{t('arcade.resetEvery2h')}</p>
              </div>
            )}
            {isBattle && (
              <div className="flex items-center justify-center gap-3 py-3 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_#f00]"></div>
                <span className="text-white text-[10px] font-black tracking-[0.3em] italic uppercase">{t('arcade.battleInProgress')}</span>
                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_#00f]"></div>
              </div>
            )}
            {isResult && !showResultModal && (
              <button onClick={startNewRound} className="w-full pixel-button bg-[#f1c40f] text-black py-3 font-black text-xs tracking-[0.2em] border-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(241,196,15,0.3)]">
                {t('arcade.nextRound')}
              </button>
            )}
          </div>
        </div>

        {/* ═══ UPCOMING MATCHES ═══ */}
        {upcomingMatches.map((m,i) => <UpcomingCard key={i} match={m} index={i} />)}

        <div className="h-4"></div>
      </div>

      {/* ═══ RESULT MODAL ═══ */}
      {showResultModal && winner && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-full max-w-[320px] bg-[#0a0c14] border-4 p-6 flex flex-col items-center relative overflow-hidden ${winner==='red'?'border-red-600 shadow-[0_0_40px_rgba(255,51,68,0.3)]':'border-blue-600 shadow-[0_0_40px_rgba(59,130,246,0.3)]'}`}>
            <div className="arcade-crt-overlay rounded"></div>
            <h3 className="text-[#f1c40f] text-sm font-black tracking-[0.3em] uppercase mb-4">{t('arcade.matchResult')}</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl drop-shadow-lg">🏆</span>
              <div className={`w-16 h-16 ${winner==='red'?'drop-shadow-[0_0_20px_rgba(255,51,68,0.6)]':'drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]'}`}>
                <img src={winner==='red'?robots.red?.imagePath:robots.blue?.imagePath} className="w-full h-full object-contain image-pixelated" alt="W"/>
              </div>
            </div>
            <h4 className={`text-xl font-black italic tracking-widest mb-1 ${winner==='red'?'neon-text-red':'neon-text-blue'}`}>{winner.toUpperCase()} {t('arcade.wins')}</h4>
            {((winner==='red'&&redPct<40)||(winner==='blue'&&bluePct<40)) && (
              <span className="text-[#f1c40f] text-[8px] font-black tracking-[0.3em] uppercase animate-pulse mb-2">{t('arcade.upsetVictory')}</span>
            )}
            <div className="w-full bg-black/60 border border-white/10 p-3 mb-4 space-y-1">
              <div className="flex justify-between text-[8px] font-mono"><span className="text-gray-500">POOL</span><span className="text-white font-bold">{totalPool} TON</span></div>
              <div className="flex justify-between text-[8px] font-mono"><span className="text-gray-500">DEV FEE (10%)</span><span className="text-red-400 font-bold">-{(totalPool*DEV_FEE).toFixed(1)} TON</span></div>
              <div className="flex justify-between text-[8px] font-mono border-t border-white/10 pt-1"><span className="text-gray-500">PAYOUT</span><span className="text-[#f1c40f] font-bold">{poolAfterFee.toFixed(1)} TON</span></div>
            </div>
            {selectedBet ? (
              selectedBet===winner ? (
                <div className="w-full text-center mb-4">
                  <p className="text-[#2ecc71] text-sm font-black tracking-widest animate-pulse">🎉 {t('arcade.youWon')} {reward.toFixed(2)} TON</p>
                  <p className="text-[7px] text-gray-500 mt-1">({(winner==='red'?redMult:blueMult).toFixed(1)}x multiplier)</p>
                </div>
              ) : (
                <div className="w-full text-center mb-4">
                  <p className="text-red-500 text-sm font-black tracking-widest">💀 {t('arcade.youLost')} 1 TON</p>
                  <p className="text-[7px] text-gray-500 mt-1">{t('pvp.betterLuck')}</p>
                </div>
              )
            ) : (
              <p className="text-gray-500 text-[8px] font-bold mb-4 uppercase tracking-wider">{t('arcade.didntBet')}</p>
            )}
            {selectedBet && selectedBet===winner && !claimed ? (
              <button onClick={handleClaim} className="w-full py-3.5 bg-[#f1c40f] text-black font-black text-sm tracking-[0.2em] uppercase hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(241,196,15,0.4)] border-b-4 border-yellow-700">{t('raid.claim')}</button>
            ) : claimed ? (
              <div className="w-full py-3.5 bg-[#2ecc71] text-white font-black text-sm tracking-[0.2em] uppercase text-center">✅ {t('modal.rewardClaimed')}</div>
            ) : (
              <button onClick={()=>setShowResultModal(false)} className="w-full py-3 bg-gray-800 text-gray-400 font-black text-xs tracking-[0.2em] uppercase hover:bg-gray-700 transition-colors border border-gray-700">CLOSE</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcadeBetting;
