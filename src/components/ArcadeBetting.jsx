import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import { useT } from '../i18n/LanguageContext';
import { sendTelegramNotification } from '../utils/telegram';

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const DEV_FEE = 0.10;
const SEED_AMOUNT = 1; // Dev seed per side (1.0 TON each = 2.0 TON total)
const LOCK_COUNTDOWN = 5; // seconds for lock animation before battle

function generateRobots(is2v2) {
  const count = is2v2 ? 2 : 1;
  const red = [];
  const blue = [];
  const all = CHARACTERS.filter(c => c.rarity !== 'Legendary' || Math.random() > 0.8);
  
  for (let i = 0; i < count; i++) {
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
    red.push({ ...baseRed, ...rs });
    blue.push({ ...baseBlue, ...bs });
  }

  return { red, blue };
}

function getCurrentMatchRound(currentTime = new Date()) {
  const h = currentTime.getHours();
  const startHour = h;
  const nextHour = (startHour + 1) % 24;

  const is2v2 = startHour % 2 !== 0;
  const betAmount = is2v2 ? 2 : 1;

  const lockDate = new Date(currentTime);
  lockDate.setHours(startHour, 55, 0, 0);
  let secondsUntilLock = Math.max(0, Math.floor((lockDate - currentTime) / 1000));
  if (currentTime.getMinutes() >= 55) {
      secondsUntilLock = 0;
  }
  const isLocked = secondsUntilLock === 0;

  return {
    startHour,
    is2v2,
    betAmount,
    roundStartText: `${String(startHour).padStart(2,'0')}:00`,
    roundEndText: `${String(nextHour).padStart(2,'0')}:00`,
    status: isLocked ? 'LOCKED' : 'LIVE',
    secondsUntilLock,
    upcomingRounds: [
      { timeText: `${String(nextHour).padStart(2,'0')}:00`, is2v2: nextHour % 2 !== 0 },
      { timeText: `${String((nextHour + 1) % 24).padStart(2,'0')}:00`, is2v2: ((nextHour + 1) % 24) % 2 !== 0 }
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
        </div>
      </div>
    </div>
  );
};

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
      <div className="flex-1 flex justify-center gap-2">
        {match.robots.red?.map((r, i) => (
          <div key={`r-${i}`} className="flex flex-col items-center">
            <div className="w-10 h-10 relative opacity-70">
              <img src={r?.imagePath} className="w-full h-full object-contain image-pixelated" alt="R" />
            </div>
            <div className="text-[5px] text-gray-600 font-mono font-bold mt-1 space-y-px text-center">
              <div>ATK:{r?.atk} DEF:{r?.def}</div>
              <div>SPD:{r?.spd}</div>
            </div>
          </div>
        ))}
      </div>
      <span className="text-gray-700 font-black italic text-xs">VS</span>
      <div className="flex-1 flex justify-center gap-2">
        {match.robots.blue?.map((b, i) => (
          <div key={`b-${i}`} className="flex flex-col items-center">
            <div className="w-10 h-10 relative opacity-70">
              <img src={b?.imagePath} className="w-full h-full object-contain image-pixelated" alt="B" />
            </div>
            <div className="text-[5px] text-gray-600 font-mono font-bold mt-1 space-y-px text-center">
              <div>ATK:{b?.atk} DEF:{b?.def}</div>
              <div>SPD:{b?.spd}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="px-4 pb-3 text-center">
      <span className="text-[7px] text-gray-700 font-bold uppercase tracking-[0.2em]">─── MATCH STARTS SOON ───</span>
    </div>
  </div>
);

const ArcadeBetting = ({ pvpQuota, setPvpQuota, setGameBalance, setDevBalance, executeRealTonPayment, socket, poolSyncData }) => {
  const { t } = useT();
  const [gameState, setGameState] = useState('idle');
  const [matchInfo, setMatchInfo] = useState(() => getCurrentMatchRound());
  const [lockTimer, setLockTimer] = useState(LOCK_COUNTDOWN);
  const [robots, setRobots] = useState({ red: null, blue: null });
  const [selectedBet, setSelectedBet] = useState(null);
  const [winner, setWinner] = useState(null);
  const [battleFX, setBattleFX] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [pool, setPool] = useState({ red: 0, blue: 0 });
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [matchHistory, setMatchHistory] = useState([
    { round: 98, winner: 'BLUE', payout: 8.5, totalPool: 42, timestamp: Date.now()-300000 },
    { round: 99, winner: 'RED', payout: 1.2, totalPool: 55, timestamp: Date.now()-240000 },
    { round: 100, winner: 'RED', payout: 1.4, totalPool: 38, timestamp: Date.now()-180000 },
    { round: 101, winner: 'BLUE', payout: 3.1, totalPool: 61, timestamp: Date.now()-120000 },
    { round: 102, winner: 'RED', payout: 1.1, totalPool: 47, timestamp: Date.now()-60000 },
  ]);
  const [roundCounter, setRoundCounter] = useState(103);

  const limitReached = (pvpQuota?.count || 0) >= 5;
  const totalPool = pool.red + pool.blue;
  const poolAfterFee = totalPool * (1 - DEV_FEE);
  const redMult = pool.red > 0 ? (poolAfterFee / pool.red) : 0;
  const blueMult = pool.blue > 0 ? (poolAfterFee / pool.blue) : 0;
  const redPct = totalPool > 0 ? Math.round((pool.red / totalPool) * 100) : 50;
  const bluePct = totalPool > 0 ? 100 - redPct : 50;

  const reward = useMemo(() => {
    if (!winner || !selectedBet || selectedBet !== winner) return 0;
    const side = selectedBet === 'red' ? pool.red : pool.blue;
    return side > 0 ? (poolAfterFee / side) * matchInfo.betAmount : 0;
  }, [winner, selectedBet, pool, poolAfterFee, matchInfo.betAmount]);

  useEffect(() => {
    const info = getCurrentMatchRound();
    setRobots(generateRobots(info.is2v2));
    setPool({ red: SEED_AMOUNT, blue: SEED_AMOUNT });
    setUpcomingMatches([
      { robots: generateRobots(info.upcomingRounds[0].is2v2), time: info.upcomingRounds[0].timeText, is2v2: info.upcomingRounds[0].is2v2 },
      { robots: generateRobots(info.upcomingRounds[1].is2v2), time: info.upcomingRounds[1].timeText, is2v2: info.upcomingRounds[1].is2v2 },
    ]);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleSync = (data) => {
      setPool(data.pool);
      setMatchInfo(prev => ({
        ...prev,
        secondsUntilLock: data.status === 'OPEN' ? data.clock : 0,
        status: data.status
      }));
      if (data.status === 'LOCKED' && (gameState === 'idle' || gameState === 'betting')) {
        setGameState('locking');
        setLockTimer(data.clock);
      } else if (data.status === 'OPEN' && gameState === 'result') {
        const info = getCurrentMatchRound();
        setRobots(generateRobots(info.is2v2));
        setUpcomingMatches([
          { robots: generateRobots(info.upcomingRounds[0].is2v2), time: info.upcomingRounds[0].timeText, is2v2: info.upcomingRounds[0].is2v2 },
          { robots: generateRobots(info.upcomingRounds[1].is2v2), time: info.upcomingRounds[1].timeText, is2v2: info.upcomingRounds[1].is2v2 },
        ]);
        setGameState('idle');
        setSelectedBet(null);
        setWinner(null);
        setBattleFX(null);
        setShowResultModal(false);
        setClaimed(false);
      }
    };
    socket.on('poolSync', handleSync);
    if (poolSyncData) handleSync(poolSyncData);
    return () => socket.off('poolSync', handleSync);
  }, [socket, poolSyncData, gameState]);

  const calculateAndDistributeRewards = useCallback(() => {
    const tp = pool.red + pool.blue;
    const df = tp * DEV_FEE;
    setDevBalance(prev => {
      const newBalance = prev + df;
      sendTelegramNotification('devFee', {
        amount: df,
        totalDevBalance: newBalance,
        round: `Arcade #${roundCounter}`
      });
      return newBalance;
    });
  }, [pool, setDevBalance, roundCounter]);

  const simulateBattle = useCallback(() => {
    const scoreTeam = (team) => team.reduce((sum, r) => sum + (r.atk * 1.5) + (r.spd*1.2) + (r.def*1.0), 0);
    const rS = scoreTeam(robots.red), bS = scoreTeam(robots.blue), tot = rS + bS;
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
  }, [robots.red, robots.blue, pool, roundCounter, calculateAndDistributeRewards]);

  useEffect(() => {
    let timer;
    if (gameState === 'locking' && lockTimer > 0) {
      timer = setInterval(() => setLockTimer(p => p - 1), 1000);
    } else if (gameState === 'locking' && lockTimer === 0) {
      setGameState('battle'); simulateBattle();
    }
    return () => clearInterval(timer);
  }, [gameState, lockTimer, simulateBattle]);

  const handleBet = async (side) => {
    if (limitReached || selectedBet || (gameState !== 'idle' && gameState !== 'betting')) return;
    const success = await executeRealTonPayment(matchInfo.betAmount, `Arcade Bet: ${side.toUpperCase()}`, true);
    if (!success) return;
    setSelectedBet(side);
    setPvpQuota(prev => ({ ...prev, count: Math.min(5, (prev?.count || 0) + 1) }));
    if (socket) socket.emit('placeBet', { side, amount: matchInfo.betAmount });
    if (gameState === 'idle') setGameState('betting');
  };

  const handleClaim = () => { 
    if (!claimed && selectedBet === winner && reward > 0) setGameBalance(prev => prev + reward);
    setClaimed(true); 
    setTimeout(() => setShowResultModal(false), 1000); 
  };

  const last5 = matchHistory.slice(-5);
  const redWins = matchHistory.filter(m=>m.winner==='RED').length;
  const totalM = matchHistory.length;
  const redWR = totalM>0 ? Math.round((redWins/totalM)*100) : 50;
  const blueWR = totalM>0 ? 100-redWR : 50;
  const highP = matchHistory.reduce((mx,m) => m.payout>mx.payout?m:mx, matchHistory[0]);
  const avgP = totalM>0 ? Math.round(matchHistory.reduce((s,m)=>s+m.totalPool,0)/totalM) : 0;

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
        <div className="flex-1 overflow-y-auto p-3 z-20 relative no-scrollbar">
          <div className="grid grid-cols-4 gap-1 mb-2 pb-1 border-b border-green-900/30">
            {['Round','Winner','Payout','Pool'].map(h => <span key={h} className={`text-[6px] text-[#2ecc71] font-black uppercase tracking-wider ${h==='Pool'?'text-right':h==='Round'?'':'text-center'}`}>{h}</span>)}
          </div>
          {[...matchHistory].reverse().map((m,i) => (
            <div key={i} className={`grid grid-cols-4 gap-1 py-1 border-b border-white/5 ${i===0?'bg-white/5':''}`}>
              <span className="text-[8px] text-gray-400 font-mono font-bold">#{m.round}</span>
              <span className="text-center"><span className={`inline-block w-2.5 h-2.5 rounded-full ${m.winner==='RED'?'bg-red-500 shadow-[0_0_6px_rgba(255,0,0,0.6)]':'bg-blue-500 shadow-[0_0_6px_rgba(0,100,255,0.6)]'}`}></span></span>
              <span className={`text-[8px] font-mono font-black text-center ${m.payout>=3?'text-[#f1c40f]':m.payout>=2?'text-[#2ecc71]':'text-gray-400'}`}>{m.payout}x</span>
              <span className="text-[8px] text-gray-400 font-mono text-right">{m.totalPool} TON</span>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-green-900/30 bg-black/60 z-20 relative">
          <div className="flex items-center justify-between">
            <span className="text-[7px] text-[#f1c40f] font-black uppercase tracking-[0.2em]">🔥 Hot Streak</span>
            <div className="flex gap-1">{last5.map((m,i)=>(<div key={i} className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[5px] font-black ${m.winner==='RED'?'bg-red-600 border-red-400 text-white shadow-[0_0_6px_rgba(255,0,0,0.5)]':'bg-blue-600 border-blue-400 text-white shadow-[0_0_6px_rgba(0,100,255,0.5)]'}`}>{m.winner==='RED'?'R':'B'}</div>))}</div>
          </div>
        </div>
      </div>
    );
  }

  const isBattle = gameState==='battle';
  const isResult = gameState==='result';

  return (
    <div className="flex-1 flex flex-col bg-[#080a10] overflow-hidden relative arcade-crt-container">
      <div className="arcade-crt-overlay"></div><div className="arcade-scanline"></div>

      <div className="flex-1 overflow-y-auto relative z-10 px-3 py-2 flex flex-col gap-2 no-scrollbar">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-[#f1c40f] text-base font-black italic tracking-[0.15em] drop-shadow-lg leading-none">ARCADE ARENA</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[6px] text-gray-500 font-bold uppercase tracking-wider">ROUND #{roundCounter}</span>
              <span className="text-[6px] text-gray-600">|</span>
              <span className={`text-[6px] font-bold uppercase tracking-wider ${limitReached?'text-red-500':'text-gray-500'}`}>QUOTA {5-(pvpQuota?.count || 0)}/5</span>
            </div>
          </div>
          <button onClick={()=>setShowStats(true)} className="text-[7px] text-[#2ecc71] border border-green-900/40 px-2 py-1 bg-black/80 hover:bg-green-950/30 transition-colors uppercase tracking-wider font-bold">📊 STATS</button>
        </div>

        {matchHistory.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[5px] text-gray-600 uppercase tracking-wider font-bold">{t('arcade.last5')}</span>
            <div className="flex gap-1">{last5.map((m,i)=>(<div key={i} className={`w-2 h-2 rounded-full ${m.winner==='RED'?'bg-red-600 shadow-[0_0_4px_rgba(255,0,0,0.4)]':'bg-blue-600 shadow-[0_0_4px_rgba(0,100,255,0.4)]'}`}></div>))}</div>
          </div>
        )}

        <div className={`relative rounded-lg overflow-hidden transition-all duration-500 ${isBattle?'ring-2 ring-yellow-500/50':isResult?(winner==='red'?'ring-2 ring-red-500/50':'ring-2 ring-blue-500/50'):'ring-2 ring-cyan-500/30'}`} style={{background:'linear-gradient(180deg, #0f1520 0%, #0a0e18 100%)'}}>
          <div className="px-3 pt-2 pb-1 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isBattle?'bg-yellow-400 animate-pulse':isResult?'bg-gray-500':'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.6)]'}`}></div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${isBattle?'text-yellow-400':isResult?'text-gray-400':'text-red-400'}`}>
                {isBattle?'⚔️ BATTLE':isResult?'🏆 FINISHED':gameState==='locking'?'🔒 LOCKED':'🔴 LIVE'}
              </span>
            </div>
            {(gameState==='idle'||gameState==='betting') && matchInfo.secondsUntilLock > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[5px] text-gray-500 uppercase tracking-wider leading-none">CLOSES IN</span>
                <span className="text-sm font-black italic tabular-nums text-[#f1c40f] leading-none mt-0.5">{formatTime(matchInfo.secondsUntilLock)}</span>
              </div>
            )}
            {gameState==='locking' && <span className="text-sm font-black italic tabular-nums text-red-500 animate-pulse">{lockTimer}</span>}
          </div>

          {gameState==='locking' && (
            <div className="absolute inset-0 z-30 bg-black/60 flex items-center justify-center pointer-events-none">
              <div className="bg-black/90 px-4 py-2 border-y-2 border-red-600 animate-pulse w-full text-center">
                <span className="text-base font-black text-red-500 italic uppercase">BETTING CLOSED</span>
              </div>
            </div>
          )}

          <div className="px-3 py-1 flex items-center justify-center gap-1 relative min-h-[80px]">
            <div className={`flex-1 flex justify-center gap-1 ${battleFX==='red-attack'?'anim-attack-right':''} ${battleFX==='blue-attack'?'anim-hit':''}`}>
              {robots.red?.map((r,i)=>(
                <div key={`tr-${i}`} className={`flex flex-col items-center flex-1 ${winner==='blue'&&isResult?'opacity-30':''}`}>
                  <img src={r?.imagePath} className="w-14 h-14 object-contain image-pixelated" alt="R"/>
                  <div className={`mt-1 bg-black/60 border border-red-900/30 p-1 w-full max-w-[60px] text-center ${winner==='red'&&isResult?'neon-border-red':''}`}>
                    <span className="text-[5px] font-mono text-white block">A:{r?.atk} D:{r?.def} S:{r?.spd}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="z-20 -mt-2">
              <div className={`w-7 h-7 rounded-full bg-black/80 border border-gray-700/50 flex items-center justify-center ${isBattle?'animate-pulse border-yellow-500/50 shadow-[0_0_10px_rgba(241,196,15,0.3)]':''}`}>
                <span className="text-[8px] font-black italic text-gray-500">{isBattle?'⚔️':'VS'}</span>
              </div>
            </div>
            <div className={`flex-1 flex justify-center gap-1 ${battleFX==='blue-attack'?'anim-attack-left':''} ${battleFX==='red-attack'?'anim-hit':''}`}>
              {robots.blue?.map((b,i)=>(
                <div key={`tb-${i}`} className={`flex flex-col items-center flex-1 ${winner==='red'&&isResult?'opacity-30':''}`}>
                  <img src={b?.imagePath} className="w-14 h-14 object-contain image-pixelated" alt="B"/>
                  <div className={`mt-1 bg-black/60 border border-blue-900/30 p-1 w-full max-w-[60px] text-center ${winner==='blue'&&isResult?'neon-border-blue':''}`}>
                    <span className="text-[5px] font-mono text-white block">A:{b?.atk} D:{b?.def} S:{b?.spd}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPool > 0 && (
            <div className="px-3 py-1">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[5px] font-black text-red-500 uppercase tracking-tighter">RED: {redPct}%</span>
                <span className="text-[5px] font-black text-blue-500 uppercase tracking-tighter">BLUE: {bluePct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-900 border border-white/5 flex overflow-hidden rounded-full">
                <div className="h-full bg-gradient-to-r from-red-700 to-red-500" style={{width:`${redPct}%`}}></div>
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700" style={{width:`${bluePct}%`}}></div>
              </div>
              <div className="flex justify-between mt-1 items-center">
                <span className="text-[5px] text-gray-500 font-mono font-bold uppercase">TOTAL: {totalPool.toFixed(1)} TON</span>
                <div className="flex gap-1.5">
                  <span className="text-[5px] text-red-500 font-mono font-bold uppercase">{redMult.toFixed(2)}X</span>
                  <span className="text-[5px] text-blue-500 font-mono font-bold uppercase">{blueMult.toFixed(2)}X</span>
                </div>
              </div>
            </div>
          )}

          <div className="px-3 pb-2 pt-1">
            {(gameState==='idle'||gameState==='betting') && !limitReached && (
              <div className="flex gap-1.5">
                <button onClick={()=>handleBet('red')} disabled={selectedBet!==null} className={`flex-1 py-1.5 border-2 font-black text-[9px] tracking-widest flex items-center justify-center gap-1 transition-all ${selectedBet==='red'?'bg-red-600 border-white text-white':'bg-gradient-to-b from-red-700 to-red-900 border-red-500/50 text-white'}`}>BET RED</button>
                <button onClick={()=>handleBet('blue')} disabled={selectedBet!==null} className={`flex-1 py-1.5 border-2 font-black text-[9px] tracking-widest flex items-center justify-center gap-1 transition-all ${selectedBet==='blue'?'bg-blue-600 border-white text-white':'bg-gradient-to-b from-blue-700 to-blue-900 border-blue-500/50 text-white'}`}>BET BLUE</button>
              </div>
            )}
            {isBattle && <div className="text-center py-1.5"><span className="text-white text-[8px] font-black tracking-[0.2em] uppercase animate-pulse">{t('arcade.battleInProgress')}</span></div>}
            {isResult && !showResultModal && <button onClick={startNewRound} className="w-full bg-[#f1c40f] text-black py-1.5 font-black text-[9px] tracking-[0.2em] border-white uppercase shadow-lg shadow-yellow-500/20">{t('arcade.nextRound')}</button>}
          </div>
        </div>

        {upcomingMatches.map((m,i) => <UpcomingCard key={i} match={m} />)}
        <div className="h-2"></div>
      </div>

      {showResultModal && winner && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-full max-w-[300px] bg-[#0a0c14] border-4 p-5 flex flex-col items-center relative overflow-hidden ${winner==='red'?'border-red-600 shadow-[0_0_30px_rgba(255,51,68,0.3)]':'border-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.3)]'}`}>
            <div className="arcade-crt-overlay rounded"></div>
            <h3 className="text-[#f1c40f] text-[10px] font-black tracking-[0.3em] uppercase mb-4">{t('arcade.matchResult')}</h3>
            <div className="flex justify-center gap-2 mb-4">
              {(winner==='red'?robots.red:robots.blue)?.map((r,i)=>(<div key={`w-${i}`} className="w-12 h-12"><img src={r?.imagePath} className="w-full h-full object-contain image-pixelated" alt="W"/></div>))}
            </div>
            <h4 className={`text-lg font-black italic tracking-widest mb-3 ${winner==='red'?'neon-text-red':'neon-text-blue'}`}>{winner.toUpperCase()} {t('arcade.wins')}</h4>
            <div className="w-full bg-black/60 border border-white/10 p-2.5 mb-4 space-y-1">
              <div className="flex justify-between text-[7px] font-mono"><span className="text-gray-500">POOL</span><span className="text-white font-bold">{totalPool} TON</span></div>
              <div className="flex justify-between text-[7px] font-mono border-t border-white/10 pt-1"><span className="text-gray-500">PAYOUT</span><span className="text-[#f1c40f] font-bold">{poolAfterFee.toFixed(1)} TON</span></div>
            </div>
            {selectedBet ? (
              <div className="w-full text-center mb-4">
                <p className={`text-xs font-black tracking-widest ${selectedBet===winner?'text-[#2ecc71] animate-pulse':'text-red-500'}`}>{selectedBet===winner ? `🎉 +${reward.toFixed(2)} TON` : '💀 LOST'}</p>
              </div>
            ) : <p className="text-gray-500 text-[7px] font-bold mb-4 uppercase">{t('arcade.didntBet')}</p>}
            {selectedBet && selectedBet===winner && !claimed ? (
              <button onClick={handleClaim} className="w-full py-2.5 bg-[#f1c40f] text-black font-black text-xs tracking-[0.2em] uppercase shadow-lg shadow-yellow-500/20">{t('raid.claim')}</button>
            ) : (
              <button onClick={()=>setShowResultModal(false)} className="w-full py-2 bg-gray-800 text-gray-400 font-black text-[9px] tracking-[0.2em] uppercase border border-gray-700">CLOSE</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcadeBetting;
