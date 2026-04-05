import { useState, useMemo, useEffect, useRef } from 'react';
import { CHARACTERS, RARITY_COLORS } from './data/characters';
import { BOSSES, GACHA_COST_TON, DROP_RATES, REPAIR_FEE_PERCENT, calcRepairCost, BASE_RATE_PER_ATK, TIER_PRICING, RARITY_ORDER } from './data/tokenomics';
import { useGacha } from './hooks/useGacha';
import { useHeroRoster } from './hooks/useHeroRoster';
import { TonConnectButton, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import PvpArena from './components/PvpArena';
import Sprite from './components/Sprite';
import ArcadeBetting from './components/ArcadeBetting';
import IdleMining from './components/IdleMining';
import { useT } from './i18n/LanguageContext';
import { useMining } from './hooks/useMining';
import { useReferral } from './hooks/useReferral';
import ReferralHub from './components/ReferralHub';
import { useMissions } from './hooks/useMissions';
import EarnFreeMech from './components/EarnFreeMech';
import { sendTelegramNotification } from './utils/telegram';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const TON_COIN_PATH = '/ton_coin.png?cache-bust=1';

// Icons placeholders using emojis/text for retro vibe
const IconBattle = () => (
  <div className="relative w-8 h-8 flex items-center justify-center">
    <img 
      src="/battle_icon.png" 
      alt="Battle" 
      className="w-full h-full object-contain image-pixelated drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" 
    />
  </div>
);
const IconGacha = () => <img src="/gacha_icon.png" alt="Gacha" className="w-[30px] h-[30px] object-contain image-pixelated translate-y-[-2px]" />;
const IconHeroes = () => (
  <div className="relative w-8 h-8 flex items-center justify-center">
    {/* Hero Sprite - Shield removed as requested */}
    <img 
      src="/Robot/epic_16.png" 
      className="w-[28px] h-[28px] object-contain image-pixelated drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]" 
      alt="Hero Icon" 
    />
  </div>
);
const IconArena = () => <img src="/PVP.png" alt="PVP" className="w-8 h-8 object-contain image-pixelated translate-y-[-2px]" />;
const IconArcade = () => <img src="/PVP_arcade.png" alt="Arcade" className="w-8 h-8 object-contain image-pixelated translate-y-[-2px]" />;
const IconEarn = () => <img src={TON_COIN_PATH} alt="TON" className="w-[32px] h-[32px] object-contain image-pixelated drop-shadow-[0_0_5px_rgba(30,144,255,0.3)]" />;
const IconReferral = () => <span className="text-2xl drop-shadow-[0_0_5px_rgba(255,255,255,0.4)] relative -top-1">🤝</span>;
const IconTon = ({ className }) => <img src={TON_COIN_PATH} alt="TON" className={`object-contain aspect-square ${className || 'w-4 h-4'}`} />;
const IconPixel = () => <span>🟡</span>;
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
  </svg>
);
const IconRobotSil = ({ className = "w-4 h-4", color = "currentColor" }) => (
  <svg className={className} viewBox="0 0 16 16" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }}>
    <path d="M4 2H12V4H14V10H12V12H4V10H2V4H4V2Z" /> {/* Head */}
    <path d="M5 5H7V7H5V5Z" fill="black" fillOpacity="0.3" /> {/* Left Eye */}
    <path d="M9 5H11V7H9V5Z" fill="black" fillOpacity="0.3" /> {/* Right Eye */}
    <path d="M2 5H1V8H2V5Z" /> {/* Left Ear */}
    <path d="M14 5H15V8H14V5Z" /> {/* Right Ear */}
    <path d="M6 12H10V14H6V12Z" /> {/* Neck */}
  </svg>
);

const PREVIEW_DATA = [
  CHARACTERS.find(c => c.rarity === 'Common'),
  CHARACTERS.find(c => c.rarity === 'Rare'),
  CHARACTERS.find(c => c.rarity === 'SR'),
  CHARACTERS.find(c => c.rarity === 'Epic'),
  CHARACTERS.find(c => c.rarity === 'Legendary')
].filter(Boolean);

const IconMining = () => (
  <div className="relative w-8 h-8 flex items-center justify-center">
    <span className="text-2xl drop-shadow-lg">⛏️</span>
  </div>
);

const IconMission = () => (
  <div className="relative w-8 h-8 flex items-center justify-center translate-y-[-2px]">
    <img src="/gacha_icon.png" alt="Mission" className="w-[30px] h-[30px] object-contain image-pixelated brightness-110 drop-shadow-[0_0_8px_rgba(241,196,15,0.4)]" />
  </div>
);



// Blockchain Config
const RECIPIENT_ADDRESS = "UQBc7XwYlXbqVYO76GOizi3Ji97aFHj98jKfbKUkUWKUgP2p";
const DEV_WALLET_ADDRESS = RECIPIENT_ADDRESS; // Dev wallet used for withdrawals and deposits
const GACHA_FEE_TON = 1.0;
const UPGRADE_FEE_TON = 0.5;

function App() {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const { t, lang, toggleLang } = useT();
  const [activeTab, setActiveTab] = useState('raid');
  const [raidView, setRaidView] = useState('list');
  const [pullResult, setPullResult] = useState(null);
  const [isPulling, setIsPulling] = useState(false);
  const [showRates, setShowRates] = useState(false);

  // ─── ROSTER & MISSIONS HOOKS ───
  const { buyTier } = useGacha();
  const { userHeroes, heroCount, maxCapacity, canAdd, addHeroes, rarityCounts, repairHeroes, upgradeHero, mergeHeroes, getDuplicates, getSameRarityHeroes } = useHeroRoster();
  
  // ─── MODAL SYSTEM (Needs to be defined before socket effects) ───
  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, 
    type: 'alert', 
    title: '', 
    message: '', 
    confirmText: '', 
    cancelText: '',
    onConfirm: null 
  });

  const triggerModal = (config) => {
    setModalConfig({
      isOpen: true,
      type: config.type || 'alert',
      title: config.title || '',
      message: config.message || '',
      confirmText: config.confirmText || '',
      cancelText: config.cancelText || '',
      onConfirm: config.onConfirm || null
    });
  };

  // ─── FINANCIAL STATES ───
  const [gameBalance, setGameBalance] = useState(() => {
    const saved = localStorage.getItem('pixel_war_game_balance');
    return saved ? parseFloat(saved) : 0;
  });
  const [devBalance, setDevBalance] = useState(() => {
    const saved = localStorage.getItem('pixel_war_dev_balance');
    return saved ? parseFloat(saved) : 0;
  });

  // ─── PVP & MISSIONS ───
  const [pvpStats, setPvpStats] = useState({ matches: 0, wins: 0, rank: 'Bronze' });
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  
  // ─── STABLE REFERENCES FOR SOCKET LISTENERS ───
  const addHeroesRef = useRef(addHeroes);
  useEffect(() => { addHeroesRef.current = addHeroes; }, [addHeroes]);
  
  const missionData = useMissions(socket, wallet?.account?.address, addHeroes);
  const miningData = useMining(userHeroes, socket, wallet?.account?.address);

  // Global Socket & Online Players State
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [poolData, setPoolData] = useState(null);

  useEffect(() => {
    // Initialize socket connection globally
    const socketInstance = io(SOCKET_URL);
    socketRef.current = socketInstance;
    setSocket(socketInstance);
    
    socketInstance.on('poolSync', (data) => {
      setPoolData(data);
      if (data.onlineCount !== undefined) {
        setOnlineCount(data.onlineCount);
      }
    });

    // Listen for real online players list
    socketRef.current.on('onlinePlayers', (data) => {
      setOnlineCount(data.count);
      setTotalPlayers(data.total || 0);
      setOnlinePlayers(data.players || []);
    });

    // Register player with backend on connect
    socketRef.current.on('connect', () => {
      const currentWallet = localStorage.getItem('ton_wallet_address'); // or fetch from state if sync is immediate
      socketRef.current.emit('registerPlayer', {
        name: localStorage.getItem('pixel_war_player_name') || 'Player1',
        wallet: currentWallet
      });
    });

    // Handle persistent status from DB
    socketRef.current.on('playerStatus', (data) => {
      if (data.balance !== undefined) {
        setGameBalance(data.balance);
      }
      if (data.pvpStats) {
        setPvpStats(data.pvpStats);
      }
    });

    // Mining events
    socketRef.current.on('mining:claimed', (data) => {
      setGameBalance(data.newBalance);
    });

    socketRef.current.on('mining:error', (data) => {
      console.warn('[Mining Error]', data.message);
    });

    // Withdrawal events
    socketRef.current.on('withdrawal:success', (data) => {
      setGameBalance(data.newBalance);
      console.log('[Withdrawal] Balance updated from server:', data.newBalance);
    });

    socketRef.current.on('mission:rewardClaimed', (result) => {
      triggerModal({
        type: 'alert',
        title: 'MISSION REWARD!',
        message: `Congratulations! You received ${result.rewardLabel}`,
        confirmText: t('modal.understood')
      });
    });

    socketRef.current.on('mission:boxOpened', (data) => {
      if (data.success) {
        // Pick a random common hero
        const commonChars = CHARACTERS.filter(c => c.rarity === 'Common');
        const picked = commonChars[Math.floor(Math.random() * commonChars.length)];
        const added = addHeroesRef.current([picked]);
        if (added) {
            triggerModal({
                type: 'alert',
                title: 'BOX OPENED!',
                message: `You got a new Common Mech: ${picked.name}`,
                confirmText: 'AWESOME!'
            });
        }
      }
    });

    socketRef.current.on('mission:error', (data) => {
      triggerModal({
        type: 'alert',
        title: 'MISSION ERROR',
        message: data.message,
        confirmText: 'OK'
      });
    });

    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);
  const [repairTarget, setRepairTarget] = useState(null);
  const [heroFilter, setHeroFilter] = useState('ALL');
  const [selectedHero, setSelectedHero] = useState(null);
  const [showCapacityWarning, setShowCapacityWarning] = useState(false);
  const [gachaAnim, setGachaAnim] = useState(null); // 'falling', 'shaking', 'burst', 'revealed'
  
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [activeRepairType] = useState('all'); 

  // Long-press Popup State
  const [longPressHero, setLongPressHero] = useState(null);
  const longPressTimerRef = useRef(null);

  const handlePointerDown = (hero, e) => {
    e.preventDefault();
    longPressTimerRef.current = setTimeout(() => {
      setLongPressHero(hero);
    }, 400);
  };

  // Merge & Upgrade State
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelections, setMergeSelections] = useState([]);
  const [mergeSourceHero, setMergeSourceHero] = useState(null);
  const [upgradeResult, setUpgradeResult] = useState(null);
  const [mergeResult, setMergeResult] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [fusionSourceHeroes, setFusionSourceHeroes] = useState([]);
  const [fusionParticles] = useState(() => Array.from({ length: 20 }).map(() => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    tx: `${(Math.random() - 0.5) * 400}px`,
    ty: `${(Math.random() - 0.5) * 400}px`,
    delay: `${Math.random() * 2}s`
  })));

  const handlePointerUp = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    setLongPressHero(null);
  };
  
  // Welcome Gift States (Wallet Connected Reward)
  const [welcomeHeroes, setWelcomeHeroes] = useState(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPlusOneBadge, setShowPlusOneBadge] = useState(false);

  // Withdrawal States
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [paymentRecipient, setPaymentRecipient] = useState(RECIPIENT_ADDRESS);
  
  // Real Balance State (from Blockchain)
  const [tonBalance, setTonBalance] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Force clean legacy mock balance from localStorage
  useEffect(() => {
    localStorage.removeItem('pixel_war_balance');
  }, []);

  // Persist gameBalance and devBalance
  useEffect(() => {
    localStorage.setItem('pixel_war_game_balance', gameBalance.toString());
  }, [gameBalance]);

  useEffect(() => {
    localStorage.setItem('pixel_war_dev_balance', devBalance.toString());
  }, [devBalance]);

  // Custom Themed Modal System
  const [successNotification, setSuccessNotification] = useState(null);
  // Profile State
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('pixel_war_player_name') || 'Player1');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showNameMandatory, setShowNameMandatory] = useState(false);
  const [tempName, setTempName] = useState('');
  
  const GRADE_COLORS = {
    'S': '#f1c40f',
    'A': '#a29bfe',
    'B': '#2ecc71',
    'C': '#95a5a6'
  };


  // PVP & Arcade Shared Quota State (5 per 2 hours)
  const [pvpQuota, setPvpQuota] = useState(() => {
    const currentPeriodId = Math.floor(Date.now() / (2 * 3600 * 1000));
    const saved = localStorage.getItem('pixel_war_pvp_quota');
    const defaultStats = { count: 0, lastResetDayId: currentPeriodId };
    try {
      const parsed = saved ? JSON.parse(saved) : defaultStats;
      // Perform reset if period changed during initialization
      if (parsed.lastResetDayId !== currentPeriodId) {
        return { count: 0, lastResetDayId: currentPeriodId };
      }
      return parsed;
    } catch {
      return defaultStats;
    }
  });

  // Persist pvpQuota when changed
  useEffect(() => {
    localStorage.setItem('pixel_war_pvp_quota', JSON.stringify(pvpQuota));
  }, [pvpQuota]);

  useEffect(() => {
    localStorage.setItem('pixel_war_player_name', playerName);
    // Sync name change to backend
    if (socketRef.current?.connected) {
      socketRef.current.emit('updatePlayer', { name: playerName });
    }
  }, [playerName]);

  // Mandatory Name Change Check
  useEffect(() => {
    if (playerName === 'Player1') {
      setShowNameMandatory(true);
      setTempName('');
    } else {
      setShowNameMandatory(false);
    }
  }, [playerName]);

  // Sync wallet address to backend when wallet connects/disconnects
  useEffect(() => {
    const addr = wallet?.account?.address || null;
    if (addr) {
      localStorage.setItem('ton_wallet_address', addr);
      if (socketRef.current?.connected) {
        socketRef.current.emit('registerPlayer', {
          name: playerName,
          wallet: addr
        });
      }
    } else {
      localStorage.removeItem('ton_wallet_address');
    }
  }, [wallet, playerName]);

  // Real-time Balance Fetching
  const fetchBalance = useMemo(() => async () => {
    if (!wallet?.account?.address) return;
    try {
      const response = await fetch(`https://tonapi.io/v2/accounts/${wallet.account.address}`);
      const data = await response.json();
      if (data && data.balance) {
        setTonBalance(parseFloat(data.balance) / 1000000000);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  }, [wallet?.account?.address]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 20000); // Poll every 20s
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // One-time Welcome Gift Trigger (Now 3 Common Heroes for connecting wallet)
  useEffect(() => {
    const hasClaimed = localStorage.getItem('pixel_war_welcome_claimed');
    // If wallet connected and never claimed, trigger the 3-hero free gift
    if (wallet && hasClaimed !== 'true' && !welcomeHeroes) {
      setTimeout(() => {
        // Filter for Common heroes only
        const commonPool = CHARACTERS.filter(c => c.rarity === 'Common');
        if (commonPool.length >= 3) {
          // Select 3 unique random common heroes
          const shuffled = [...commonPool].sort(() => 0.5 - Math.random());
          const results = shuffled.slice(0, 3).map(hero => ({
            ...hero,
            instanceId: Date.now() + Math.random().toString(16).slice(2, 8),
            currentHp: hero.hp,
            level: 1,
            exp: 0,
            isDeployed: false
          }));
          
          setWelcomeHeroes(results);
          setShowWelcomeModal(true);
        }
      }, 500); // Slight delay for better UX feel after connection
    }
  }, [wallet, welcomeHeroes]);

  // Generic Internal Payment Helper (Deducts from gameBalance, adds to devBalance)
  const executeGamePayment = async (amount, label) => {
    // 1. Check if player has enough virtual balance
    if (gameBalance < amount) {
      triggerModal({
        type: 'alert',
        title: 'INSUFFICIENT FUNDS',
        message: `You need at least ${amount.toFixed(2)} TON in your virtual balance to perform this action.`,
        confirmText: 'OK'
      });
      return false;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      console.log(`Processing Internal Payment: ${label || 'Transaction'}...`);
      // Simulate slight delay for transaction feel
      await new Promise(resolve => setTimeout(resolve, 600));

      // 2. Deduct from Player
      setGameBalance(prev => prev - amount);
      
      // 3. Add to Dev Balance tracking and notify
      setDevBalance(prev => {
        const newBalance = prev + amount;
        sendTelegramNotification('devFee', {
          amount: amount,
          totalDevBalance: newBalance,
        });
        return newBalance;
      });

      return true;
    } catch (e) {
      console.error("Payment failed:", e);
      setPaymentError("Internal payment failed.");
      return false;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Real Blockchain Payment Helper for withdrawals (via backend treasury wallet)
  const executeRealTonPayment = async (amount, label, recipient = RECIPIENT_ADDRESS, suppressNotification = false) => {
    console.log('=== WITHDRAWAL DEBUG ===');
    console.log('Wallet address:', wallet?.account?.address);
    console.log('Recipient:', recipient);
    console.log('Amount:', amount);
    
    if (!wallet?.account?.address) {
      console.error('No wallet connected');
      triggerModal({
        type: 'alert',
        title: t('modal.warning'),
        message: "Please connect your wallet first!",
        confirmText: t('modal.understood')
      });
      return false;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      console.log(`Starting Withdrawal via Backend Treasury: ${label || 'Withdrawal'}...`);
      
      // Call backend API to send via treasury wallet
      const response = await fetch(
        `${import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'}/api/withdraw`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amount,
            destinationAddress: recipient,
            wallet: wallet.account.address
          })
        }
      );

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error(`Server error: ${responseText.substring(0, 200)}`);
      }
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || 'Withdrawal failed');
      }

      console.log('Withdrawal successful:', result);
      
      const txId = result.txId;

      if (!suppressNotification) {
        // Withdrawal notification
        sendTelegramNotification('withdrawal', {
          amount: amount,
          txId: txId || `tx_${Date.now()}`,
          recipient: recipient
        });
      }

      return { success: true, transactionId: txId };
    } catch (e) {
      console.error("Withdrawal failed:", e);
      console.error("Error details:", e.message, e.stack);
      triggerModal({
        type: 'alert',
        title: 'WITHDRAWAL FAILED',
        message: `Error: ${e.message || 'Unknown error'}`,
        confirmText: 'OK'
      });
      setPaymentError("Withdrawal failed: " + e.message);
      return false;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleMergeConfirm = async () => {
    if (mergeSelections.length !== 3) return;
    
    // Await Real Blockchain Payment
    const success = await executeGamePayment(UPGRADE_FEE_TON, "Hero Fusion/Merge");
    if (!success) return;

    // Start Fusion Animation Sequence
    const sources = mergeSelections.map(id => userHeroes.find(h => h.instanceId === id));
    setFusionSourceHeroes(sources);
    setIsMerging(true);
    setMergeMode(false);
    
    setTimeout(() => {
      const result = mergeHeroes(mergeSelections);
      if (result) {
        setIsMerging(false);
        setMergeSelections([]);
        setMergeSourceHero(null);
        setSelectedHero(null);
        setMergeResult(result);
      } else {
        setIsMerging(false);
      }
    }, 2500); // 2.5s Fusion sequence
  };

  const handleClaimWelcomeGift = () => {
    if (welcomeHeroes && welcomeHeroes.length > 0) {
      addHeroes(welcomeHeroes);
      localStorage.setItem('pixel_war_welcome_claimed', 'true');
      setShowPlusOneBadge(true);
      setShowWelcomeModal(false);
      setWelcomeHeroes(null);
      // Revert badge after 3 seconds
      setTimeout(() => setShowPlusOneBadge(false), 3000);
    }
  };



  const handleSaveProfile = (newName) => {
    const trimmed = newName.trim();
    if (trimmed.length >= 3 && trimmed.length <= 15) {
      setPlayerName(trimmed);
      setIsEditingProfile(false);
      setShowNameMandatory(false);
    }
  };

  const resetAllData = () => {
    triggerModal({
      type: 'confirm',
      title: '⚠️ RESET ALL DATA',
      message: 'This will wipe all your progress, heroes, and balance. This cannot be undone!\n\nAre you sure you want to clear everything for the server push?',
      confirmText: 'RESET EVERYTHING',
      onConfirm: () => {
        // Clear LocalStorage
        localStorage.clear();
        
        // Reset States
        setGameBalance(0);
        setDevBalance(0);
        setPlayerName('Player1');
        setPvpQuota({ count: 0, lastResetDayId: Math.floor(Date.now() / (2 * 3600 * 1000)) });
        resetReferrals();
        
        // Reload page to ensure all hooks/states are fresh
        window.location.reload();
      }
    });
  };

  const handleDepositSimulation = (baseAmount = 15.0) => {
    const bonusPct = 0.20;
    const bonusAmount = baseAmount * bonusPct;
    const total = baseAmount + bonusAmount;
    const prevBalance = gameBalance;
    const newBalance = prevBalance + total;

    setGameBalance(newBalance);
    setSuccessNotification({
      type: 'deposit',
      amount: baseAmount,
      bonus: bonusAmount,
      total: total,
      prevBalance: prevBalance,
      newBalance: newBalance
    });

    // Send Telegram Notification
    sendTelegramNotification('deposit', {
      amount: baseAmount,
      bonus: bonusAmount,
      total: total,
      newBalance: newBalance
    });
  };
  window.handleDepositSimulation = handleDepositSimulation;

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > gameBalance) {
      triggerModal({
        type: 'alert',
        title: 'INSUFFICIENT V-TON',
        message: `Your V-TON balance only has ${gameBalance.toFixed(2)} available.`,
        confirmText: 'OK'
      });
      return;
    }
    if (!withdrawAddress) return;

    const fee = amount * 0.1;
    const netAmount = amount - fee;

    const paymentResult = await executeRealTonPayment(netAmount, 'V-TON Withdrawal', withdrawAddress);
    if (!paymentResult || !paymentResult.success) {
      return;
    }

    setWithdrawAmount('');
    setWithdrawAddress('');

    setSuccessNotification({
      type: 'withdrawal',
      amount: netAmount,
      address: withdrawAddress,
      net: netAmount,
      txId: paymentResult.transactionId || `tx_${Date.now()}`
    });
  };

  const handleWithdrawAmountChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setWithdrawAmount(val);
    }
  };

  // Derived tokenomics values

  // Repair bill for the entire roster
  const repairAllBill = useMemo(() => {
    let totalCost = 0;
    const damagedAll = userHeroes.filter(h => h.needsRepair);
    const breakdownMap = {};
    
    damagedAll.forEach(hero => {
      if (!breakdownMap[hero.rarity]) breakdownMap[hero.rarity] = { rarity: hero.rarity, count: 0, totalGroupCost: 0, color: hero.color };
      const cost = calcRepairCost(hero.atk);
      breakdownMap[hero.rarity].count += 1;
      breakdownMap[hero.rarity].totalGroupCost += cost;
      totalCost += cost;
    });

    return { 
      breakdown: Object.values(breakdownMap).sort((a, b) => (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5)), 
      totalCost, 
      damagedCount: damagedAll.length,
      damagedIds: damagedAll.map(h => h.instanceId)
    };
  }, [userHeroes]);

  const currentRepairBill = repairAllBill;

  // Filtered heroes for display
  const filteredHeroes = useMemo(() => {
    if (heroFilter === 'ALL') return userHeroes;
    return userHeroes.filter(h => h.rarity === heroFilter);
  }, [userHeroes, heroFilter]);

  // Sort: Legendary first, then by obtainedAt desc
  const sortedHeroes = useMemo(() => {
    return [...filteredHeroes].sort((a, b) => {
      const rd = (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5);
      if (rd !== 0) return rd;
      return (b.obtainedAt || 0) - (a.obtainedAt || 0);
    });
  }, [filteredHeroes]);

  const handleBuyTier = async (rarity) => {
    if (isPulling) return;
    
    // Check capacity first
    if (!canAdd(1)) {
      setShowCapacityWarning(true);
      return;
    }

    const cost = TIER_PRICING[rarity];

    // Deduct from player's real TON wallet via blockchain payment
    const success = await executeRealTonPayment(cost, `Buy ${rarity} Mech`);
    if (!success) return;

    setIsPulling(true);
    setPullResult(null);
    setGachaAnim('falling');

    // step 1: Falling (0.8s)
    setTimeout(() => {
      setGachaAnim('shaking');
      
      // step 2: Shaking (1.2s)
      setTimeout(() => {
        setGachaAnim('burst');
        
        // step 3: Burst (0.6s)
        setTimeout(() => {
          const chars = buyTier(rarity);
          setPullResult(chars);
          setGachaAnim(null);
          setIsPulling(false);
        }, 600);
      }, 1200);
    }, 800);
  };

  const handleConfirmPull = () => {
    if (pullResult) {
      addHeroes(pullResult);
    }
    setPullResult(null);
  };

  // --- REFERRAL SYSTEM ---
  // useReferral hook - using tonBalance and fetchBalance to sync
  // useReferral hook - correctly bound to in-game gameBalance
  const { referralData, claimRewards, resetReferrals } = useReferral(gameBalance, setGameBalance);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative overflow-hidden bg-[var(--color-game-bg)] font-pixel text-[10px] sm:text-xs">
      
      <header className="theme-header-bg sticky top-0 z-[60] p-3 px-4 shadow-[0_4px_25px_rgba(0,0,0,0.6)] flex flex-col gap-3.5 border-b border-[#2a2d36] backdrop-blur-xl bg-black/60 overflow-hidden">
        {/* Animated Header Background Glow */}
        <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-[#facc15]/10 blur-[100px] pointer-events-none"></div>

        {/* LINE 1: BRANDING & TITLE */}
        <div className="flex justify-center items-center w-full relative py-0.5">
          <div className="h-10 sm:h-12 w-48 pointer-events-none relative flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Pixel War" 
              className="h-full w-full object-contain filter drop-shadow-[0_0_15px_rgba(255,215,0,0.4)] animate-pulse-slow scale-[1.2]" 
            />
          </div>
        </div>

        {/* LINE 2: FINANCIAL & WALLET TOOLBAR */}
        <div className="flex items-center justify-start gap-1 w-full p-1 sm:p-1.5 bg-black/40 rounded-xl border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
          {/* TON Connect Button - Scaled down for sleekness */}
          <div className="origin-left scale-[0.45] sm:scale-60 h-7 flex items-center shrink-0">
            <TonConnectButton />
          </div>

          <div className="flex items-center gap-1.5 -ml-8">
            {/* Real TON Balance Badge */}
            <div className="flex items-center gap-1.5 bg-[#1a1c23] border border-gray-700/50 px-2 py-1 rounded-lg text-[8px] font-bold shadow-md hover:border-gray-500 transition-all cursor-default">
              <IconTon className="w-2.5 h-2.5 opacity-80" />
              <span className="text-gray-300 font-mono tracking-tight">{tonBalance.toFixed(2)}</span>
            </div>

            {/* In-Game Virtual Balance Badge (Premium Styled) */}
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600/20 to-emerald-900/40 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[9px] font-black shadow-[0_0_15px_rgba(16,185,129,0.1)] group relative overflow-hidden active:scale-95 transition-all">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <IconTon className="w-3 h-3 drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
              <span className="text-[#34d399] font-mono tracking-tight whitespace-nowrap flex items-center gap-1">
                {gameBalance.toFixed(2)} <span className="text-[6px] opacity-70 uppercase">V-TON</span>
              </span>
            </div>
          </div>
        </div>

        {/* LINE 3: COMMUNITY & PROFILE IDENTITY */}
        <div className="flex items-center justify-between w-full h-6 px-0.5">
          {/* Community Stats (Online/Total) */}
          <div className="relative group/online">
            <button className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-full hover:bg-emerald-500/10 transition-all shadow-[0_0_8px_rgba(16,185,129,0.05)]">
              <div className="flex items-center gap-1.5 pr-1.5 border-r border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                <span className="text-emerald-400 text-[6.5px] font-black uppercase tracking-wider">
                  {onlineCount} {t('players.online')}
                </span>
              </div>
              <span className="text-gray-500 text-[6.5px] font-black uppercase tracking-wider opacity-60">
                {totalPlayers} {t('players.total')}
              </span>
            </button>
            
            {/* Floating Dropdown List (Better Styled) */}
            <div className="hidden group-hover/online:block absolute top-[120%] left-0 w-52 bg-[#0d0f14]/95 border border-emerald-500/30 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[200] backdrop-blur-md animate-in slide-in-from-top-2 duration-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-emerald-500/20 bg-emerald-500/10">
                <span className="text-[7px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  {t('players.online')} ({onlineCount})
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                {onlinePlayers.length > 0 ? onlinePlayers.map((p, i) => (
                  <div key={p.id || i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                    <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-500 border border-white/5">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] text-white font-bold truncate tracking-tight">{p.name}</span>
                      {p.wallet && (
                        <span className="text-[5px] text-gray-500 font-mono tracking-widest uppercase truncate">{p.wallet.slice(0, 10)}...</span>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-4 text-center">
                    <span className="text-[8px] text-gray-600 italic uppercase tracking-widest">No agents found</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Player Identity & Settings Group */}
          <div className="flex items-center gap-2.5">
            {/* Profile Label/Edit Button */}
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-yellow-500/40 transition-all group"
            >
              <span className="text-white text-[9px] font-bold tracking-tight truncate max-w-[70px] drop-shadow-md group-hover:text-yellow-400 transition-all">
                {playerName}
              </span>
            </button>

            {/* Language Switch Capsule */}
            <button 
              onClick={toggleLang}
              className="h-6 flex items-center gap-1.5 px-2 bg-black/40 border border-gray-700/50 hover:border-yellow-500/60 rounded-lg text-[6.5px] font-black tracking-widest text-gray-400 hover:text-yellow-400 transition-all active:scale-95 shadow-lg group"
            >
              <span className="opacity-50 group-hover:opacity-100">🌐</span>
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 flex flex-col z-10 p-2 pb-20 overflow-y-auto no-scrollbar">
        
        {activeTab === 'raid' && (
          <div className="flex flex-col flex-1 relative min-h-full">
            {/* Background Watermark */}
            <div 
              className="absolute inset-x-0 top-0 bottom-[-50px] z-0 opacity-[0.05] pointer-events-none bg-center bg-repeat image-pixelated translate-y-[-20px] grayscale-[0.5]"
              style={{ backgroundImage: "url('/pvp_bg.png')", backgroundSize: '320px' }}
            ></div>
            
            <div className="relative z-10 w-full flex flex-col flex-1">
              {raidView === 'list' ? (
                <section className="flex flex-col items-center mb-2 w-full">
                  <div className="text-center mb-2 w-full">
                    <h2 className="text-yellow-400 text-base font-bold drop-shadow-md animate-pulse uppercase tracking-wider">{t('raid.bossTitle')}</h2>
                    <p className="text-gray-400 text-[7px] mt-0.5 uppercase">{t('raid.selectBoss')}</p>
                  </div>
                  
                  <div className="flex flex-col gap-2 w-full px-1">
                    {BOSSES.map((boss, idx) => {
                      // All bosses unlocked for debug/test mode
                      const isUnlocked = true;

                      return (
                        <div 
                          key={boss.id} 
                          className={`relative w-full pixel-border p-2 transition-all ${
                            'opacity-100 cursor-pointer hover:bg-white/5 active:scale-[0.98]'
                          }`}
                          style={{ 
                            backgroundColor: `${boss.color}10`, 
                            borderColor: boss.color
                          }}
                          onClick={() => {
                            miningData?.selectBoss?.(idx);
                            setRaidView('room');
                          }}
                        >

                          <div className="flex gap-3 items-center">
                            <div className="w-14 h-16 bg-black/40 pixel-border-sm flex-shrink-0 relative overflow-hidden" style={{ borderColor: boss.color }}>
                              <img src={boss.image} alt={boss.name} className="w-full h-full object-cover image-pixelated" />
                              <div className="absolute top-0 right-0 bg-black/80 text-[5px] px-1 text-white font-bold">T{boss.tier}</div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center">
                              <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: boss.color }}>{boss.name}</h3>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="bg-black/50 px-1.5 py-1 border border-white/5 text-[7px] inline-block w-fit">
                                  <p className="text-gray-400">
                                    {t('raid.bonus')}: <span className="text-yellow-400 font-black">{boss.baseHp.toLocaleString()}</span>
                                  </p>
                                </div>
                                <p className="text-[6px] text-yellow-500/80 font-bold uppercase tracking-tight italic">
                                  * {t('raid.commonOnly', { 
                                      rarity: (['Common', 'Rare', 'SR', 'Epic', 'Legendary'][boss.tier - 1] || 'Common').toUpperCase(), 
                                      max: 10 
                                    })}
                                </p>
                              </div>
                              <p className="text-[5px] text-gray-500 mt-2 uppercase tracking-widest opacity-50">
                                {t('raid.selectToBattle')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <>
                  {/* Boss Info Panel */}
                  <section className="flex flex-col items-center mb-1 px-1">
                    <div className="w-full flex justify-between items-center mb-2">
                      <button 
                        onClick={() => setRaidView('list')} 
                        className="py-1 px-2 bg-black/40 text-gray-500 hover:text-white hover:bg-black/60 pixel-border-sm text-[6px] transition-colors font-bold"
                      >
                        ← {t('raid.changeBoss')}
                      </button>
                      <div className="text-right">
                        <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: BOSSES[miningData?.miningState?.currentBossIndex || 0]?.color }}>
                          {BOSSES[miningData?.miningState?.currentBossIndex || 0]?.name}
                        </div>
                        <div className="text-[5px] text-gray-600 font-bold uppercase tracking-tighter">Current Target</div>
                      </div>
                    </div>

                    <div className="relative w-36 h-44 mb-2">
                      <div 
                        className="w-full h-full pixel-border flex items-center justify-center overflow-hidden relative bg-black/20 animate-float"
                        style={{ borderColor: BOSSES[miningData?.miningState?.currentBossIndex || 0]?.color }}
                      >
                        <img 
                          src={BOSSES[miningData?.miningState?.currentBossIndex || 0]?.image} 
                          alt="Boss" 
                          className="w-full h-full object-cover image-pixelated relative z-10"
                        />
                        {(miningData?.miningState?.zones?.[miningData?.miningState?.currentBossIndex || 0]?.hp ?? 1) <= 0 && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                            <span className="text-white text-[7px] font-black tracking-[0.2em] bg-emerald-600 px-3 py-1.5 animate-bounce uppercase">DEFEATED!</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Boss HP Bar */}
                    <div className="w-full max-w-[280px] bg-gray-900/80 h-4 border border-white/10 relative overflow-hidden rounded-sm">
                      <div 
                        className="h-full transition-all duration-300 shadow-[0_0_10px_rgba(255,0,0,0.3)]" 
                        style={{ 
                          width: `${((miningData?.miningState?.zones?.[miningData?.miningState?.currentBossIndex || 0]?.hp ?? 0) / (BOSSES[miningData?.miningState?.currentBossIndex || 0]?.baseHp || 1)) * 100}%`, 
                          backgroundColor: BOSSES[miningData?.miningState?.currentBossIndex || 0]?.color 
                        }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center text-white text-[7px] font-black drop-shadow-md tracking-widest">
                        {Math.floor(miningData?.miningState?.zones?.[miningData?.miningState?.currentBossIndex || 0]?.hp ?? 0).toLocaleString()} / {(BOSSES[miningData?.miningState?.currentBossIndex || 0]?.baseHp || 0).toLocaleString()} HP
                      </div>
                    </div>
                  </section>

                  {/* --- INTEGRATED MINING FACILITY --- */}
                  <IdleMining 
                    miningData={miningData}
                    userHeroes={userHeroes}
                    executeGamePayment={executeGamePayment}
                    triggerModal={triggerModal}
                    sendTelegramNotification={sendTelegramNotification}
                    onClaim={(amount) => {
                      setGameBalance(prev => prev + amount);
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* GACHA TAB */}
        {activeTab === 'gacha' && (
          <section className="flex flex-col items-center flex-1 pt-0 pb-2 animate-in fade-in duration-300 relative min-h-full overflow-hidden">
            <div 
              className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-center bg-no-repeat bg-cover image-pixelated"
              style={{ backgroundImage: "url('/gacha_bg.jpg')" }}
            ></div>
            
            <div className="relative z-10 w-full flex flex-col items-center flex-1 lg:max-w-md mx-auto">
              <div className="w-full flex justify-center items-center mb-1 px-3 mt-1">
                  <h2 className="text-[9px] text-[var(--color-pixel)] drop-shadow-md font-pixel tracking-widest uppercase">{t('gacha.portalTitle')}</h2>
              </div>

              {/* 3+2 Robot Previews with Stats */}
              <div className="w-full flex flex-col gap-4 mt-4 px-2">
                {[
                  ['Common', 'Rare', 'SR'],
                  ['Epic', 'Legendary']
                ].map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-4">
                    {row.map((tier) => {
                      const hero = PREVIEW_DATA.find(h => h.rarity === tier) || PREVIEW_DATA[0];
                      const colorMap = { Common: '#bdc3c7', Rare: '#3498db', SR: '#2ecc71', Epic: '#9b59b6', Legendary: '#f1c40f' };
                      const color = colorMap[tier];
                      const dailyYield = (hero.atk * BASE_RATE_PER_ATK).toFixed(2);
                      
                      return (
                        <div key={tier} className="flex flex-col items-center w-[90px]">
                          <div className="relative w-16 h-16 flex items-center justify-center mb-1">
                            <div className="absolute inset-0 blur-xl opacity-20 rounded-full" style={{ backgroundColor: color }}></div>
                            <div className="w-14 h-14 relative z-10 animate-float" style={{ animationDelay: `${rIdx * 0.2}s` }}>
                              <Sprite char={hero} />
                            </div>
                          </div>
                          <div className="text-[8px] font-black tracking-widest mb-1 shadow-sm uppercase" style={{ color: color }}>
                            {tier === 'SR' ? 'SUPER RARE' : tier.toUpperCase()}
                          </div>
                          <div className="bg-[#050505] border border-gray-800 p-1.5 w-full flex flex-col items-center gap-0.5 rounded-sm shadow-lg">
                            <div className="text-white text-[7px] font-bold tracking-tighter uppercase leading-none">ATK: {hero.atk}</div>
                            <div className="text-yellow-400 text-[7px] font-mono font-bold leading-none">{dailyYield} TON/D</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 3+2 Tier Purchase Icons */}
              <div className="w-full flex flex-col gap-6 mt-8 pb-4">
                {[
                  ['Common', 'Rare', 'SR'],
                  ['Epic', 'Legendary']
                ].map((row, rIdx) => (
                  <div key={rIdx} className="flex justify-center gap-6">
                    {row.map((tier) => {
                      const cost = TIER_PRICING[tier];
                      const colorMap = { Common: '#bdc3c7', Rare: '#3498db', SR: '#2ecc71', Epic: '#9b59b6', Legendary: '#f1c40f' };
                      const color = colorMap[tier];
                      
                      return (
                        <button 
                          key={tier}
                          onClick={() => handleBuyTier(tier)}
                          disabled={isPulling}
                          className={`flex flex-col items-center justify-center transition-all active:scale-90 ${isPulling ? 'opacity-50' : 'hover:scale-110'}`}
                        >
                          {/* Gacha Machine Icon */}
                          <div className="relative mb-1">
                            <img src="/gacha_icon.png" alt={tier} className="w-12 h-12 object-contain image-pixelated drop-shadow-lg" />
                            <div 
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-white text-[6px] px-1.5 py-0.5 border-2 font-black uppercase text-nowrap leading-none shadow-md"
                              style={{ backgroundColor: color, borderColor: 'white' }}
                            >
                              {tier === 'SR' ? 'SUPER RARE' : tier.toUpperCase()}
                            </div>
                          </div>
                          
                          {/* Price Button Box */}
                          <div className="mt-3 bg-black border-2 px-3 py-1 flex items-center justify-center gap-1.5 shadow-xl min-w-[60px]" style={{ borderColor: color }}>
                            <IconTon className="w-3 h-3" />
                            <span className="text-white text-[12px] font-black leading-none">{cost}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Gacha Animation Overlay */}
            {isPulling && (
              <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                 <div className="relative flex flex-col items-center">
                    {/* Background Rays */}
                    {gachaAnim !== 'falling' && (
                      <div className="absolute inset-0 anim-gacha-rays opacity-30 pointer-events-none">
                         <div className="w-96 h-96 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 rounded-full blur-xl"></div>
                      </div>
                    )}
                    <div className={`gacha-capsule ${gachaAnim === 'falling' ? 'anim-gacha-fall' : ''} ${gachaAnim === 'shaking' ? 'anim-gacha-shake' : ''} ${gachaAnim === 'burst' ? 'anim-gacha-burst' : ''}`}>
                       <div className="gacha-capsule-half gacha-capsule-top"></div>
                       <div className="gacha-capsule-half gacha-capsule-bottom"></div>
                       <div className="gacha-capsule-line"></div>
                    </div>
                    <div className="mt-8 text-white text-[10px] font-bold tracking-widest animate-pulse">
                       {gachaAnim === 'falling' && t('gacha.initSummon')}
                       {gachaAnim === 'shaking' && t('gacha.stabPower')}
                       {gachaAnim === 'burst' && t('gacha.summonComplete')}
                    </div>
                    {gachaAnim === 'burst' && <div className="fixed inset-0 z-[110] anim-gacha-flash"></div>}
                 </div>
              </div>
            )}

            {/* Gacha Result Display Overlays */}
            {pullResult && !isPulling && (
              <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
                <h3 className="text-[#f1c40f] text-xl mb-6 font-pixel uppercase tracking-widest">{t('gacha.summonResult')}</h3>
                <div className={`grid gap-2 ${pullResult.length > 1 ? (pullResult.length > 10 ? 'grid-cols-10 overflow-y-auto max-h-[60vh] p-2' : 'grid-cols-5') : 'grid-cols-1'} mb-8 w-full max-w-[440px] justify-center px-1`}>
                  {pullResult.map((char, index) => (
                    <div key={index} className={`bg-[var(--color-game-panel)] p-1 pixel-border border-[1px] flex flex-col items-center relative ${pullResult.length === 1 ? 'scale-150' : (pullResult.length > 10 ? 'scale-75' : 'scale-100')} transition-transform`} style={{borderColor: char.color}}>
                       <div className="absolute -top-3 bg-black px-1 text-[4px] whitespace-nowrap z-10" style={{color: char.color}}>
                         {char.rarity === 'SR' ? 'SR' : char.rarity?.slice(0,3)}
                       </div>
                       <div className="w-8 h-8 flex items-center justify-center mb-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ backgroundColor: char.imageColor }}>
                          <div className="w-6 h-6"><Sprite char={char} /></div>
                       </div>
                       {/* Grade Badge */}
                       {char.grade && (
                         <div className="absolute top-0 right-0 px-1 text-[5px] font-black" style={{ backgroundColor: GRADE_COLORS[char.grade] || '#888', color: '#000' }}>
                            {char.grade}
                         </div>
                       )}
                       {/* Element Badge Removed */}
                       {pullResult.length === 1 && <span className="text-center text-[8px] mt-1">{char.name}</span>}
                    </div>
                  ))}
                </div>
                <button onClick={handleConfirmPull} className="pixel-button bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 text-xs font-pixel tracking-widest pixel-border-sm">
                  {t('gacha.confirm')}
                </button>
              </div>
            )}
          </section>
        )}

        {/* HEROES TAB */}
        {activeTab === 'heroes' && (
          <section className="flex flex-col flex-1 animate-in fade-in duration-300 relative overflow-hidden">
            
            {/* Dark Watermark Background */}
            <div 
              className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-center bg-repeat image-pixelated"
              style={{ backgroundImage: "url('/heroes_bg.png')", backgroundSize: '380px' }}
            ></div>

            <div className="relative z-10 w-full flex flex-col flex-1">
              {/* Header with capacity */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm text-[var(--color-pixel)] drop-shadow-md flex items-center gap-2">
                  <img src="/Robot/epic_16.png" alt="Hero Icon" className="w-5 h-5 image-pixelated drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]" />
                  {t('heroes.title')}
                </h2>
              </div>
              <span className="text-[8px] text-gray-400">{heroCount} / {maxCapacity}</span>
            </div>
            
            {/* Capacity Bar */}
            <div className="w-full bg-black/60 h-3 pixel-border-sm mb-3 relative overflow-hidden">
              <div 
                className={`h-full capacity-bar-fill ${heroCount / maxCapacity > 0.9 ? 'danger' : heroCount / maxCapacity > 0.7 ? 'warning' : ''}`}
                style={{ width: `${(heroCount / maxCapacity) * 100}%` }}
              />
            </div>

            {/* Rarity Filter Tabs */}
            <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar">
              {[
                { key: 'ALL', label: 'ALL', color: '#f1c40f', count: heroCount },
                { key: 'Legendary', label: 'LEG', color: '#f1c40f', count: rarityCounts.Legendary },
                { key: 'Epic', label: 'EPIC', color: '#9b59b6', count: rarityCounts.Epic },
                { key: 'SR', label: 'SR', color: '#2ecc71', count: rarityCounts.SR },
                { key: 'Rare', label: 'RARE', color: '#3498db', count: rarityCounts.Rare },
                { key: 'Common', label: 'COM', color: '#95a5a6', count: rarityCounts.Common },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setHeroFilter(f.key)}
                  className={`flex-shrink-0 px-2 py-1 text-[7px] border rounded transition-all flex items-center gap-1 ${heroFilter === f.key ? 'bg-white/10 border-white text-white' : 'border-gray-800 text-gray-500'}`}
                  style={{ 
                    borderColor: heroFilter === f.key ? f.color : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {f.label}
                  <span className="bg-black/50 px-1 rounded text-[5px] font-bold" style={{ color: f.color }}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Hero Grid */}
            {sortedHeroes.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-12">
                <span className="text-4xl mb-4 opacity-50">🛡️</span>
                <p className="text-center text-[10px] mb-2">{heroFilter === 'ALL' ? t('heroes.noHeroes') : t('heroes.noRarityHeroes', { rarity: heroFilter })}</p>
                {heroFilter === 'ALL' && (
                  <button 
                    onClick={() => setActiveTab('gacha')} 
                    className="pixel-button bg-[var(--color-pixel)] text-black px-4 py-2 text-[8px] pixel-border-sm mt-2"
                  >
                    {t('raid.goSummon')}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {['Legendary', 'Epic', 'SR', 'Rare', 'Common'].map((rarity) => {
                  if (heroFilter !== 'ALL' && heroFilter !== rarity) return null;
                  
                  const groupHeroes = sortedHeroes.filter(h => h.rarity === rarity);
                  if (groupHeroes.length === 0) return null;

                  const rarityColor = RARITY_COLORS[rarity] || '#888';
                  const rarityLabel = rarity === 'SR' ? 'SUPER RARE' : rarity.toUpperCase();

                  return (
                    <div key={rarity} className="flex flex-col gap-2">
                      {/* Rarity Header */}
                      <div className="flex items-center gap-2">
                        <div 
                          className="px-2 py-0.5 text-[7px] font-black tracking-widest border border-white/10 min-w-[80px] text-center uppercase"
                          style={{ color: rarityColor, backgroundColor: rarityColor + '10' }}
                        >
                          {rarityLabel} ({groupHeroes.length})
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
                      </div>

                      {/* Rarity Grid */}
                      <div className="grid grid-cols-4 gap-2 px-1">
                        {groupHeroes.map((hero) => (
                          <button
                            key={hero.instanceId}
                            onClick={() => setSelectedHero(hero)}
                            onPointerDown={(e) => handlePointerDown(hero, e)}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onContextMenu={(e) => e.preventDefault()}
                            className={`hero-card rarity-glow-${hero.rarity} bg-[var(--color-game-panel)] p-1.5 pixel-border-sm flex flex-col items-center relative cursor-pointer select-none touch-none`}
                            style={{ borderColor: hero.color }}
                          >
                            {/* Rarity Badge */}
                            <div className="absolute -top-1.5 right-0 px-1 text-[4px] bg-black/80 border border-gray-700" style={{ color: hero.color }}>
                              {hero.rarity === 'SR' ? 'S.Rare' : hero.rarity}
                            </div>
                            {/* Level Badge */}
                            <div className="absolute -top-1.5 left-0 px-1 text-[4px] bg-black/80 border border-gray-700 text-gray-400">
                              Lv.{hero.level}
                            </div>
                            {/* Star Level Indicator (Center Top) */}
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none z-10">
                              {Array.from({ length: hero.level || 1 }).map((_, idx) => (
                                <span key={idx} className="text-[#f1c40f] text-[6px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">★</span>
                              ))}
                            </div>
                            {/* Sprite Area */}
                            <div className="w-12 h-12 flex items-center justify-center mb-1 relative" style={{ backgroundColor: hero.imageColor }}>
                              <div className="w-10 h-10">
                                <Sprite char={hero} />
                              </div>
                            </div>
                            {/* Name */}
                            <span className="text-[5px] text-gray-400 truncate w-full text-center leading-tight mb-0.5">{hero.name}</span>
                            {/* Stats */}
                            <div className="flex flex-col items-center w-full gap-[2px] text-[7px] font-bold leading-none mt-0.5">
                              <div className="flex gap-2">
                                <span className="text-red-400">HP:{hero.hp}</span>
                                <span className="text-orange-400">ATK:{hero.atk}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-blue-400">DEF:{hero.def}</span>
                                <span className="text-emerald-400">SPD:{hero.spd}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </section>
        )}

        {/* PVP Arena Tab */}
        {activeTab === 'rank' && (
          <PvpArena 
            userHeroes={userHeroes}
            pvpStats={pvpStats}
            setPvpStats={setPvpStats}
            pvpQuota={pvpQuota}
            setPvpQuota={setPvpQuota}
            gameBalance={gameBalance}
            setGameBalance={setGameBalance}
            setDevBalance={setDevBalance}
            socket={socketRef.current}
            onLongPressStart={handlePointerDown}
            onLongPressEnd={handlePointerUp}
          />
        )}

        {/* ARCADE TAB */}
        {activeTab === 'arcade' && (
          <ArcadeBetting 
            pvpStats={pvpStats}
            setPvpStats={setPvpStats}
            pvpQuota={pvpQuota}
            setPvpQuota={setPvpQuota}
            gameBalance={gameBalance}
            setGameBalance={setGameBalance}
            setDevBalance={setDevBalance}
            executeRealTonPayment={executeRealTonPayment}
            socket={socketRef.current}
            poolSyncData={poolData}
          />
        )}



        {activeTab === 'earn' && (
          <section className="flex flex-col flex-1 animate-in fade-in duration-300 relative px-2">
            
            {/* Dark Watermark Background */}
            <div 
              className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-center bg-no-repeat bg-cover image-pixelated"
              style={{ backgroundImage: "url('/gacha_bg.jpg')" }}
            ></div>

            <div className="relative z-10 w-full flex flex-col flex-1">
              <h2 className="text-base text-center py-2 mb-1 tracking-widest text-[#f1c40f] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">{t('withdraw.title')}</h2>
              
              <div className="flex flex-col gap-3 px-1 pb-4">
                
                {/* Input 1: Amount */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">{t('withdraw.amountLabel')}</span>
                    <span className="text-[7px] text-[#2ecc71] font-bold">{t('withdraw.max')}: {gameBalance.toFixed(2)} V-TON</span>
                  </div>
                  <div className="flex items-stretch h-12 bg-black/60 pixel-border border-gray-700 w-full focus-within:border-[#f1c40f] transition-all">
                    <input 
                      type="text"
                      value={withdrawAmount}
                      onChange={handleWithdrawAmountChange}
                      placeholder="0.00"
                      className="flex-1 bg-transparent border-none text-white px-3 text-right font-mono text-base outline-none placeholder:text-gray-800"
                    />
                    <button onClick={() => setWithdrawAmount(gameBalance.toString())} className="h-full px-3 bg-[#1a1c23] hover:bg-[#2c303f] border-l-2 border-[#111] flex items-center justify-center transition-colors">
                      <IconTon className="w-5 h-5 mx-auto" />
                    </button>
                  </div>
                </div>

                {/* Input 2: Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-400 px-1 font-bold uppercase">{t('withdraw.addressLabel')}</label>
                  <div className="flex items-stretch h-12 bg-black/60 pixel-border border-gray-700 w-full focus-within:border-[#f1c40f] transition-all">
                    <input 
                      type="text"
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      placeholder="EQA..."
                      className="flex-1 bg-transparent border-none text-gray-400 px-3 font-mono text-[8px] outline-none placeholder:text-gray-800"
                    />
                  </div>
                </div>

                {/* Calculations Box */}
                <div className="flex justify-center my-0.5 relative">
                  <div className="bg-black/40 border border-white/5 w-full p-3 space-y-2 relative overflow-hidden">
                     <div className="flex justify-between items-center text-[9px]">
                       <span className="text-gray-500 font-bold uppercase tracking-wide">{t('withdraw.amount')}</span>
                       <span className="font-mono text-white text-[10px]">{withdrawAmount || '0.00'}</span>
                     </div>
                     <div className="flex justify-between items-center text-[9px]">
                       <span className="text-red-500 font-bold uppercase tracking-wide">{t('withdraw.fee')}</span>
                       <span className="font-mono text-red-500 text-[10px]">-{withdrawAmount ? (withdrawAmount * 0.1).toFixed(2) : '0.00'}</span>
                     </div>
                     <div className="w-full border-t border-dashed border-white/5 my-1"></div>
                     <div className="flex justify-between items-center text-[10px] font-black">
                       <span className="text-[#f1c40f] uppercase tracking-wider">{t('withdraw.netAmount')}</span>
                       <span className="font-mono text-[#f1c40f] text-xs drop-shadow-md">{withdrawAmount ? (withdrawAmount * 0.9).toFixed(2) : '0.00'}</span>
                     </div>
                  </div>
                </div>

                {/* Dev Fee Reminder */}
                <div className="bg-[#13141a]/80 border border-white/5 flex flex-col relative mt-1 shadow-lg">
                   <div className="flex items-start gap-3 p-3 pb-1.5">
                     <span className="text-xl opacity-80">🖥️</span>
                     <div className="flex flex-col pt-0.5">
                       <span className="text-[#a0a5b5] text-[9px] font-bold uppercase">{t('withdraw.devFeeTitle')}</span>
                       <span className="text-[#6a7185] text-[6px] leading-[1.3]">{t('withdraw.devFeeDesc1')} {t('withdraw.devFeeDesc2')}</span>
                     </div>
                   </div>
                   <div className="bg-[#2a0e0e]/80 border-t border-[#ff3344]/30 p-1.5 mt-1">
                     <p className="text-[#ff5555] text-[6px] leading-tight text-center font-bold tracking-widest uppercase">
                       ⚠ {t('withdraw.warning1')} {t('withdraw.warning2')} ⚠
                     </p>
                   </div>
                </div>

                {/* Submit Button */}
                <div className="mt-2 mb-4">
                  <button 
                    disabled={!withdrawAmount || !withdrawAddress}
                    onClick={handleWithdraw}
                    className="w-full py-3 text-[11px] font-black tracking-[0.2em] text-[#111] flex justify-center items-center gap-2 transition-all relative overflow-hidden uppercase h-14"
                    style={{
                       backgroundColor: (!withdrawAmount || !withdrawAddress) ? '#333' : '#f1c40f',
                       border: '2px solid',
                       borderColor: (!withdrawAmount || !withdrawAddress) ? '#222' : '#ffffff',
                    }}
                  >
                    {!withdrawAmount || !withdrawAddress ? (
                      <span className="text-gray-600">{t('withdraw.fillAll')}</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <IconTon className="w-6 h-6" />
                        <span className="drop-shadow-sm">{t('withdraw.button')}</span>
                        <IconTon className="w-6 h-6" />
                      </div>
                    )}
                  </button>
                </div>

                {/* Referral Hub Integrated into Withdraw Page */}
                <div className="mt-8 border-t border-white/5 pt-6">
                  <h3 className="text-[10px] text-gray-500 font-black uppercase tracking-[0.25em] mb-4 text-center">— {t('nav.referral')} SYSTEM —</h3>
                  <ReferralHub 
                    referralData={referralData} 
                    onClaim={claimRewards} 
                    balance={tonBalance} 
                    triggerModal={triggerModal}
                    resetReferrals={resetReferrals}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* MISSION TAB */}
        {activeTab === 'mission' && (
          <EarnFreeMech 
            missionData={missionData}
            triggerModal={triggerModal}
            onOpenBox={() => {
                // Logic to open box: 1. Deduct ticket on server 2. Add hero on client
                socketRef.current.emit('mission:openBox');
            }}
            navigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

      </main>

      {/* Drop Rates Modal */}
      {showRates && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
           <div className="bg-[var(--color-game-panel)] p-4 pixel-border w-full max-w-xs relative">
              <button 
                onClick={() => setShowRates(false)} 
                className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 flex items-center justify-center pixel-border-sm pixel-button"
              >X</button>
              <h3 className="text-[#f1c40f] mb-4 text-center">{t('rates.title')}</h3>
              <table className="w-full text-left text-[8px] mb-4">
                <tbody>
                  <tr className="text-[var(--color-legendary)]"><td className="py-2 border-b border-gray-700">{t('common.legendary')}</td><td className="text-right border-b border-gray-700">{(DROP_RATES.Legendary / 100).toFixed(1)}%</td></tr>
                  <tr className="text-[var(--color-epic)]"><td className="py-2 border-b border-gray-700">{t('common.epic')}</td><td className="text-right border-b border-gray-700">{(DROP_RATES.Epic / 100).toFixed(1)}%</td></tr>
                  <tr className="text-[var(--color-sr)]"><td className="py-2 border-b border-gray-700">{t('common.superRare')}</td><td className="text-right border-b border-gray-700">{(DROP_RATES.SR / 100).toFixed(1)}%</td></tr>
                  <tr className="text-[var(--color-rare)]"><td className="py-2 border-b border-gray-700">{t('common.rare')}</td><td className="text-right border-b border-gray-700">{(DROP_RATES.Rare / 100).toFixed(1)}%</td></tr>
                  <tr className="text-[var(--color-common)]"><td className="py-2">{t('common.common')}</td><td className="text-right">{(DROP_RATES.Common / 100).toFixed(1)}%</td></tr>
                </tbody>
              </table>
              <div className="text-[6px] text-gray-400 bg-black/40 p-2 leading-relaxed">
                {t('rates.epicGuaranteed')}<br/>
                {t('rates.legGuaranteed')}<br/>
                {t('rates.baseRate')}
              </div>
           </div>
        </div>
      )}

      {/* Energy Depleted Modal */}
      {repairTarget && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[var(--color-game-panel)] p-1 pixel-border w-full max-w-sm relative flex flex-col items-center">
              
              <div className="w-full border-b-2 border-[#ff3344] bg-[#2a0e0e] p-4 flex flex-col items-center justify-center gap-2 mb-4">
                 <div className="text-4xl animate-pulse drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]">🔋❌</div>
                 <h2 className="text-[#ff3344] text-xl animate-pulse text-center leading-tight">{t('modal.unitOffline')}</h2>
              </div>
              
              <div className="flex flex-col items-center w-full px-4 text-center relative mb-6">
                 <div className="w-24 h-24 bg-gray-800 pixel-border flex items-center justify-center mb-4 grayscale animate-glitch opacity-70 p-2" style={{borderColor: '#555'}}>
                    <div className="w-16 h-16"><Sprite char={repairTarget} /></div>
                 </div>
                 
                 <div className="text-[10px] space-y-2 w-full text-left bg-black/50 p-3 pixel-border-sm">
                   <p className="text-white">Unit: <span className="text-gray-400">PIXEL_G#123 ({selectedHero?.rarity} {selectedHero?.name})</span></p>
                   <p className="text-[#ff3344]">HP: 0 / {selectedHero?.hp?.toLocaleString()} min.</p>
                   <p className="text-gray-400 text-[8px] mt-1">{t('modal.reason')}</p>
                 </div>
              </div>

              <div className="w-full flex gap-3 px-4 pb-4">
                 <button onClick={() => setRepairTarget(null)} className="pixel-button flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-[10px] pixel-border-sm leading-tight text-center">
                   {t('modal.goToInventory').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br/>}</span>)}
                 </button>
                 <button className="pixel-button flex-1 bg-gray-600 text-gray-400 py-3 text-[10px] pixel-border-sm cursor-not-allowed leading-tight text-center">
                   {t('modal.repairNow').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br/>}</span>)}
                 </button>
              </div>
              
              <button 
                onClick={() => setRepairTarget(null)} 
                className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-500 text-white w-8 h-8 flex items-center justify-center pixel-border-sm pixel-button z-10"
              >X</button>
           </div>
        </div>
      )}
      {selectedHero && !mergeMode && (() => {
        const heroLevel = selectedHero.level || 1;
        const dupes = getDuplicates(selectedHero.instanceId);
        const sameRarity = getSameRarityHeroes(selectedHero.rarity, selectedHero.instanceId);
        const isMaxLevel = heroLevel >= 5;
        const canUpgrade = dupes.length > 0 && !isMaxLevel && gameBalance >= UPGRADE_FEE_TON;
        const isLegendary = selectedHero.rarity === 'Legendary';
        const canMerge = sameRarity.length >= 2 && !isLegendary && gameBalance >= UPGRADE_FEE_TON;

        const getSpriteBg = (rarity) => {
          switch(rarity) {
            case 'Legendary': return '#7a6000';
            case 'Epic': return '#4c1d95';
            case 'SR': return '#064e3b';
            case 'Rare': return '#1e3a8a';
            default: return '#334155';
          }
        };

        return (
          <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border-[3px] p-3 w-full max-w-[340px] relative rounded-xl transition-colors duration-300" style={{ borderColor: selectedHero.color, boxShadow: `0 0 20px ${selectedHero.color}66, inset 0 0 15px ${selectedHero.color}33` }}>
              <div className="text-center mb-3">
                <h2 className="text-[13px] font-black tracking-widest uppercase px-8 truncate" style={{ color: selectedHero.color, textShadow: `0 0 8px ${selectedHero.color}` }}>{selectedHero.name}</h2>
              </div>
              
              <button onClick={() => setSelectedHero(null)} 
                className="absolute top-2.5 right-2.5 bg-[#d92c2c] hover:bg-[#ff4d4d] text-white w-7 h-7 flex items-center justify-center text-[14px] font-black z-20 rounded-lg border-2 border-[#ff8080] shadow-[0_0_10px_rgba(217,44,44,0.6)] transition-all">✕</button>
              
              <div className="flex gap-2 mb-3">
                <div className="w-[130px] h-[130px] shrink-0 border-[2px] rounded-lg p-2 flex flex-col items-center justify-center relative overflow-hidden" 
                  style={{ backgroundColor: getSpriteBg(selectedHero.rarity), borderColor: selectedHero.color, boxShadow: `inset 0 0 20px ${selectedHero.color}26` }}>
                  <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${selectedHero.color} 2px, ${selectedHero.color} 4px)` }}></div>
                  <div className="w-24 h-24 relative z-10 scale-125 mb-2"><Sprite char={selectedHero} /></div>
                   <div className="absolute top-1.5 left-1.5 bg-black/70 px-1 py-0.5 rounded border border-white/20 text-[6px] font-bold z-20 flex gap-1 items-center">
                    <span style={{ color: selectedHero.color }}>{selectedHero.rarity}</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col border-[2px] bg-[#020617] rounded-lg p-2.5" style={{ borderColor: selectedHero.color }}>
                  <div className="mb-2 pb-2 border-b-2 border-[#1e3a5f]">
                    <div className="text-white text-[11px] font-black tracking-widest mb-1.5 flex items-center gap-1 drop-shadow-md">
                      LV. {heroLevel}/5
                      {isMaxLevel && <span className="text-[7px] text-yellow-400 font-black ml-1 animate-pulse px-1 bg-black/80 rounded border border-yellow-400">MAX</span>}
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-[14px] ${i < heroLevel ? 'text-[#ffcc00]' : 'text-transparent'} relative`} style={{ WebkitTextStroke: i < heroLevel ? '0px' : '1px #475569' }}>★</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between py-0.5 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black px-1 bg-white/5 rounded-sm py-0.5 border-l-2 border-red-500">
                      <span className="flex items-center gap-1.5"><span className="text-red-500 text-[11px]">❤️</span> <span className="text-white tracking-widest drop-shadow">HP</span></span>
                      <span className="text-[#34d399]">{selectedHero.hp?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black px-1 bg-white/5 rounded-sm py-0.5 border-l-2 border-orange-400">
                      <span className="flex items-center gap-1.5"><span className="text-orange-400 text-[11px]">⚔️</span> <span className="text-white tracking-widest drop-shadow">ATK</span></span>
                      <span className="text-[#34d399]">{selectedHero.atk}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black px-1 bg-white/5 rounded-sm py-0.5 border-l-2 border-blue-400">
                      <span className="flex items-center gap-1.5"><span className="text-blue-400 text-[11px]">🛡️</span> <span className="text-white tracking-widest drop-shadow">DEF</span></span>
                      <span className="text-[#34d399]">{selectedHero.def}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black px-1 bg-white/5 rounded-sm py-0.5 border-l-2 border-teal-400">
                      <span className="flex items-center gap-1.5"><span className="text-teal-400 text-[11px]">👟</span> <span className="text-white tracking-widest drop-shadow">SPD</span></span>
                      <span className="text-[#34d399]">{selectedHero.spd}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setActiveTab('raid'); setSelectedHero(null); }}
                  className="flex-1 h-16 relative overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg rounded-xl"
                  style={{ backgroundImage: "url('/bar.jpg')", backgroundSize: "300% 100%", backgroundPosition: "0% 0%", imageRendering: "pixelated", border: "none" }} 
                />
                <button 
                  onClick={async () => {
                    triggerModal({
                      type: 'confirm',
                      title: t('heroes.upgradeConfirm'),
                      message: `${t('heroes.upgradeWarning')}\n\n${t('heroes.cost')}: ${UPGRADE_FEE_TON} TON`,
                      onConfirm: async () => {
                        // Await Real Blockchain Payment
                        const success = await executeGamePayment(UPGRADE_FEE_TON, "Unit Level Upgrade");
                        if (!success) return;

                        const result = upgradeHero(selectedHero.instanceId, dupes[0].instanceId);
                        if (result) {
                          setSelectedHero(result);
                          setUpgradeResult(result);
                          setTimeout(() => setUpgradeResult(null), 2500);
                        }
                      }
                    });
                  }}
                  disabled={!canUpgrade}
                  className={`flex-1 h-16 relative overflow-hidden transition-all ${canUpgrade ? 'hover:scale-105 active:scale-95 shadow-lg' : 'opacity-40 grayscale pointer-events-none'}`}
                  style={{ backgroundImage: "url('/bar.jpg')", backgroundSize: "300% 100%", backgroundPosition: "50% 0%", imageRendering: "pixelated", border: "none", borderRadius: "12px" }}>
                  {!isMaxLevel && canUpgrade && <span className="absolute bottom-1 w-full text-center text-[5px] font-mono text-white font-bold bg-black/40 py-0.5 tracking-widest">REQ: 1</span>}
                  {isMaxLevel && <span className="absolute bottom-1 w-full text-center text-[5px] font-mono text-yellow-400 font-bold bg-black/60 py-0.5">MAXED</span>}
                </button>
                <button 
                  onClick={() => {
                    if (!canMerge) return;
                    setMergeSourceHero(selectedHero);
                    setMergeSelections([]);
                    setMergeMode(true);
                  }}
                  disabled={!canMerge}
                  className={`flex-1 h-16 relative overflow-hidden transition-all ${canMerge ? 'hover:scale-105 active:scale-95 shadow-lg' : 'opacity-40 grayscale pointer-events-none'}`}
                  style={{ backgroundImage: "url('/bar.jpg')", backgroundSize: "300% 100%", backgroundPosition: "100% 0%", imageRendering: "pixelated", border: "none", borderRadius: "12px" }}>
                  {!isLegendary && canMerge && <span className="absolute bottom-1 w-full text-center text-[5px] font-mono text-white font-bold bg-black/40 py-0.5 tracking-widest">REQ: 3</span>}
                  {isLegendary && <span className="absolute bottom-1 w-full text-center text-[5px] font-mono text-gray-400 bg-black/60 py-0.5 uppercase tracking-tighter">Max Tier</span>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ Upgrade Success Modal ═══════ */}
      {upgradeResult && (
        <div className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-4 min-h-screen animate-in fade-in duration-300">
           <div className="bg-[#161922] w-full max-w-[420px] border-[4px] border-[#000] relative shadow-[10px_10px_0_0_#000] overflow-hidden">
              {/* Blue Success Header */}
              <div className="bg-[#3b82f6] border-b-[4px] border-[#000] px-5 py-4 flex items-center gap-4">
                 <span className="text-white text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">⬆️</span>
                 <h3 className="text-white text-base sm:text-lg font-black tracking-[0.1em] uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] leading-none pt-1">
                   {t('heroes.upgradeSuccess') || "UPGRADE SUCCESS!"}
                 </h3>
              </div>
              
              <div className="p-8 sm:p-10 flex flex-col items-center">
                 <div className="w-24 h-24 mb-6 relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl animate-pulse"></div>
                    <div className="relative z-10 w-full h-full transform scale-125 anim-float-gentle" style={{ filter: `drop-shadow(0 0 10px ${upgradeResult.color})` }}>
                       <Sprite char={upgradeResult} />
                    </div>
                 </div>
                 
                 <h4 className="text-white text-lg font-black mb-1">{upgradeResult.name}</h4>
                 <div className="flex gap-1 mb-4">
                    {Array.from({ length: upgradeResult.level || 1 }).map((_, idx) => (
                      <span key={idx} className="text-[#f1c40f] text-lg drop-shadow-[0_0_8px_rgba(241,196,15,0.6)] animate-bounce" style={{ animationDelay: `${idx * 0.1}s` }}>★</span>
                    ))}
                 </div>
                 <div className="text-blue-400 text-xs font-black tracking-widest uppercase mb-8">
                   REACHED LEVEL {upgradeResult.level}
                 </div>
                 
                 <button 
                   onClick={() => setUpgradeResult(null)}
                   className="w-full h-14 bg-[#3b82f6] hover:bg-[#4f92ff] text-white text-[12px] font-black tracking-[0.15em] uppercase transition-all border-[4px] border-[#60a5fa] border-b-[#1d4ed8] border-r-[#1d4ed8] active:translate-y-1 active:shadow-none"
                 >
                   {t('common.confirm') || "CONFIRM"}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* ═══════ Merge Selection Popup ═══════ */}
      {mergeMode && mergeSourceHero && (() => {
        const rarity = mergeSourceHero.rarity;
        const available = getSameRarityHeroes(rarity, mergeSourceHero.instanceId);
        const RARITY_NEXT = { Common: 'Rare', Rare: 'SR', SR: 'Epic', Epic: 'Legendary' };
        const nextRarity = RARITY_NEXT[rarity];
        const canConfirm = mergeSelections.length === 3 && tonBalance >= UPGRADE_FEE_TON;

        return (
          <div className="fixed inset-0 z-[100] bg-[#0f111a]/95 backdrop-blur-md flex flex-col p-4 md:p-6 animate-in fade-in duration-200">
            <div className="flex-1 flex flex-col max-w-md mx-auto w-full overflow-hidden relative">
              
              {/* Header section with absolute cancel button */}
              <div className="mb-6 relative flex flex-col pt-1">
                <h2 className="text-[#e2b4ff] text-[18px] sm:text-[22px] font-black mb-1 tracking-wide" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.8), 0 0 10px rgba(168,85,247,0.4)', fontFamily: 'var(--font-heading)' }}>
                  {t('heroes.selectMerge') || "Select 3 mechs to merge"}
                </h2>
                <div className="text-[10px] text-gray-500 font-mono tracking-wider font-bold">
                  3× {rarity === 'SR' ? 'Super Rare' : rarity} <span className="text-gray-400">→</span> 1× {nextRarity === 'SR' ? 'Super Rare' : nextRarity} | {t('heroes.cost')}: 0.5 TON
                </div>
                
                <button 
                  onClick={() => { setMergeMode(false); setMergeSelections([]); }} 
                  className="absolute top-0 right-0 bg-[#262938] border-2 border-[#1c1f2e] text-gray-400 text-[10px] font-bold px-3 py-1.5 hover:bg-red-500/80 hover:text-white hover:border-red-400 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)] uppercase tracking-widest"
                >
                  {t('common.cancel') || "CANCEL"}
                </button>
              </div>

              {/* Selected Preview area */}
              <div className="flex gap-2 sm:gap-3 mb-8 justify-center items-center">
                {Array.from({ length: 3 }).map((_, i) => {
                  const sel = mergeSelections[i] ? available.find(h => h.instanceId === mergeSelections[i]) || userHeroes.find(h => h.instanceId === mergeSelections[i]) : null;
                  return (
                    <div 
                      key={i} 
                      className={`w-16 h-20 sm:w-20 sm:h-24 border-[3px] flex flex-col items-center justify-center transition-all ${sel ? 'bg-black/60 shadow-[0_0_15px_rgba(0,0,0,0.8)]' : 'border-dashed border-[#2f3549] bg-transparent'}`} 
                      style={sel ? { borderColor: sel.color } : {}}
                    >
                      {sel ? (
                         <div className="w-12 h-12" style={{ filter: `drop-shadow(0 0 4px ${sel.color})` }}><Sprite char={sel} /></div>
                      ) : (
                        <span className="text-[#2f3549] text-3xl font-light">?</span>
                      )}
                    </div>
                  );
                })}
                
                <div className="flex items-center text-gray-500 text-xl font-light mx-1 sm:mx-2">→</div>
                
                <div className="w-16 h-20 sm:w-20 sm:h-24 border-[3px] border-dashed border-purple-600 bg-purple-900/10 flex items-center justify-center animate-pulse shadow-[inset_0_0_20px_rgba(168,85,247,0.1)]">
                  <span className="text-[#fcb95b] text-3xl font-black drop-shadow-[0_0_5px_rgba(252,185,91,0.6)]">✨</span>
                </div>
              </div>

              {/* Hero Grid - scrollable */}
              <div className="flex-1 overflow-y-auto no-scrollbar pb-6 relative">
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-3 sm:gap-4 px-1">
                  {available.map(hero => {
                    const isSelected = mergeSelections.includes(hero.instanceId);
                    return (
                      <button
                        key={hero.instanceId}
                        onClick={() => {
                          if (isSelected) {
                            setMergeSelections(prev => prev.filter(id => id !== hero.instanceId));
                          } else if (mergeSelections.length < 3) {
                            setMergeSelections(prev => [...prev, hero.instanceId]);
                          }
                        }}
                        className={`flex flex-col items-center relative transition-all w-full p-1 sm:p-1.5 bg-[#0a0c10] ${isSelected ? 'scale-[1.03] z-10 opacity-100' : 'opacity-70 grayscale-[20%] hover:grayscale-0 hover:opacity-100 hover:border-gray-500'}`}
                        style={{ 
                          border: `2px solid ${isSelected ? hero.color : '#3b435a'}`, 
                          boxShadow: isSelected ? `0 0 15px ${hero.color}50` : '0 4px 6px rgba(0,0,0,0.3)' 
                        }}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#a855f7] border border-purple-300 text-white text-[10px] font-black flex items-center justify-center rounded-sm z-20 shadow-md">
                            {mergeSelections.indexOf(hero.instanceId) + 1}
                          </div>
                        )}
                        <div className="w-full aspect-square flex items-center justify-center mb-1 bg-[#1a1d27]" style={isSelected ? { backgroundColor: hero.imageColor + '30' } : {}}>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 relative" style={isSelected ? { filter: `drop-shadow(0 0 5px ${hero.color})` } : {}}>
                            <Sprite char={hero} />
                          </div>
                        </div>
                        <div className="flex flex-col w-full px-0.5 justify-center items-center pb-0.5">
                          <div className="text-[6px] text-gray-300 truncate w-full text-center font-bold">{hero.name}</div>
                          <div className="text-[5.5px] text-gray-500 font-mono tracking-wider mt-[1px]">Lv.{hero.level || 1}</div>
                          <div className="flex gap-0.5 justify-center mt-0.5">
                            {Array.from({ length: hero.level || 1 }).map((_, idx) => (
                              <span key={idx} className="text-[#f1c40f] text-[5px]">★</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {available.length < 2 && (
                  <div className="text-center text-gray-500 text-[10px] sm:text-xs mt-8 font-bold border-t border-dashed border-gray-800 pt-6">
                     {t('heroes.notEnoughToMerge', { rarity: rarity === 'SR' ? 'Super Rare' : rarity }) || `You need at least 3× ${rarity === 'SR' ? 'Super Rare' : rarity} robots to merge.`}
                  </div>
                )}
              </div>

              {/* Confirm Button Footer */}
              <div className="pt-4 border-t border-white/5 pb-2">
                <button
                  onClick={handleMergeConfirm}
                  disabled={!canConfirm}
                  className={`w-full h-[52px] sm:h-[60px] relative flex shadow-[0_4px_15px_rgba(0,0,0,0.6)] items-center justify-center text-[11px] sm:text-[13px] font-black transition-all border-[3px] tracking-wide ${canConfirm ? 'bg-[#7c3aed] hover:bg-[#8b5cf6] border-[#a78bfa] text-white animate-pulse' : 'bg-[#212638] border-[#313750] text-gray-500'}`}
                  style={{ textShadow: canConfirm ? '1px 1px 0 rgba(0,0,0,0.8)' : '1px 1px 0 rgba(0,0,0,0.5)' }}
                >
                  {mergeSelections.length < 3 ? `Select 3 mechs to merge (${mergeSelections.length}/3)` : `MERGE TO ${nextRarity === 'SR' ? 'SUPER RARE' : nextRarity.toUpperCase()} (${UPGRADE_FEE_TON} TON)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ Merging Animation Overlay ═══════ */}
      {isMerging && (
        <div className="fixed inset-0 z-[250] bg-[#0d0d16] flex flex-col items-center justify-center p-6 overflow-hidden">
          {/* Fusion Vortex */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Pulsing Core */}
            <div className={`absolute w-32 h-32 rounded-full blur-3xl opacity-60 animate-pulse`} 
              style={{ backgroundColor: fusionSourceHeroes[0]?.color || '#a855f7' }}></div>
            
            {/* Rotating Beams */}
            <div className="absolute inset-0 anim-fusion-vortex flex items-center justify-center">
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <div key={deg} className={`absolute w-1 h-32 origin-bottom anim-fusion-beam opacity-40`} 
                  style={{ transform: `rotate(${deg}deg)`, backgroundColor: fusionSourceHeroes[0]?.color }}></div>
              ))}
            </div>

            {/* Merging Mechs */}
            {fusionSourceHeroes.map((hero, i) => {
              return (
                <div 
                  key={i} 
                  className="absolute w-20 h-20 animate-in slide-in-from-top-20 duration-1000 flex items-center justify-center"
                  style={{ 
                    animation: `fusion-vortex 1.5s ease-in-out forwards`,
                    animationDelay: `${i * 0.1}s`
                  }}
                >
                  <div className="w-16 h-16 transform scale-125" style={{ filter: `drop-shadow(0 0 10px ${hero.color})` }}>
                    <Sprite char={hero} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <h2 className="text-[#a855f7] text-xl font-black tracking-[0.2em] uppercase animate-pulse" 
              style={{ textShadow: '0 0 15px rgba(168,85,247,0.8)' }}>
              Merging...
            </h2>
            <div className="text-[10px] text-gray-500 font-mono mt-2 tracking-widest">PERFORMING QUANTUM FUSION</div>
          </div>

          {/* Background Particles */}
          {fusionParticles.map((pt, i) => (
            <div 
              key={i} 
              className="fusion-particle"
              style={{ 
                left: pt.left,
                top: pt.top,
                '--tw-translate-x': pt.tx,
                '--tw-translate-y': pt.ty,
                animation: `fusion-particle 2s linear infinite`,
                animationDelay: pt.delay
              }}
            ></div>
          ))}
          
          {/* Final Flash Overlay (Triggers near end) */}
          <div className="absolute inset-0 bg-white opacity-0 pointer-events-none" 
            style={{ animation: 'flash-white 0.5s ease-out 2s forwards' }}></div>
        </div>
      )}

      {/* ═══════ Merge Result Popup ═══════ */}
      {mergeResult && (
        <div className="fixed inset-0 z-[260] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-500">
           {/* Retro 3D Container */}
           <div className="bg-[#161922] w-full max-w-[420px] border-[4px] border-[#000] relative shadow-[10px_10px_0_0_#000] overflow-hidden">
              {/* Purple Header */}
              <div className="bg-[#a855f7] border-b-[4px] border-[#000] px-5 py-4 flex items-center gap-4">
                 <span className="text-white text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">✨</span>
                 <h3 className="text-white text-base sm:text-lg font-black tracking-[0.1em] uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] leading-none pt-1">
                   {t('heroes.mergeResult') || "MERGE RESULT!"}
                 </h3>
              </div>
              
              <div className="p-8 sm:p-10 flex flex-col items-center">
                 {/* Result Aura Background */}
                 <div className={`absolute w-80 h-80 rounded-full blur-[80px] opacity-20 anim-result-aura pointer-events-none`}
                   style={{ backgroundColor: mergeResult.color }}></div>
                 
                 <div className={`w-32 h-32 flex items-center justify-center border-[4px] border-[#000] relative bg-[#1c1f26] mb-6 shadow-[4px_4px_0_0_#000]`} 
                   style={{ borderColor: '#000' }}>
                   
                   {/* Level Stars Highlight */}
                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 z-20 bg-black/80 px-2 py-0.5 border border-white/10 rounded-full">
                      {Array.from({ length: mergeResult.level || 1 }).map((_, idx) => (
                        <span key={idx} className="text-[#f1c40f] text-xs animate-pulse drop-shadow-[0_0_5px_#f1c40f]">★</span>
                      ))}
                   </div>

                   {/* Spinning Light Rays for high rarity */}
                   {(mergeResult.rarity === 'SR' || mergeResult.rarity === 'Epic' || mergeResult.rarity === 'Legendary') && (
                     <div className="absolute inset-0 opacity-20 anim-gacha-rays pointer-events-none"
                       style={{ background: `conic-gradient(from 0deg, transparent, ${mergeResult.color}, transparent 10%)` }}></div>
                   )}
                   
                   <div className="w-24 h-24 transform scale-125 anim-float-gentle" style={{ filter: `drop-shadow(0 0 15px ${mergeResult.color})` }}>
                     <Sprite char={mergeResult} />
                   </div>
                 </div>

                 <div className="text-[12px] font-black mb-1 uppercase tracking-[0.2em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ color: mergeResult.color }}>
                   {mergeResult.rarity === 'SR' ? 'SUPER RARE' : mergeResult.rarity}
                 </div>
                 <div className="text-white text-[18px] font-black mb-8 tracking-wide drop-shadow-md text-center">{mergeResult.name}</div>
                 
                 <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-[11px] mb-10 font-mono font-bold w-full max-w-[240px]">
                   <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">HP</span><span className="text-red-400">{mergeResult.hp?.toLocaleString()}</span></div>
                   <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">ATK</span><span className="text-[#fcb95b]">{mergeResult.atk}</span></div>
                   <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">DEF</span><span className="text-blue-400">{mergeResult.def}</span></div>
                   <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">SPD</span><span className="text-emerald-400">{mergeResult.spd}</span></div>
                 </div>

                 <button 
                   onClick={() => { setMergeResult(null); setFusionSourceHeroes([]); }} 
                   className="w-full h-14 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-[12px] font-black tracking-[0.2em] uppercase transition-all border-[4px] border-[#a78bfa] border-b-[#5b21b6] border-r-[#5b21b6] active:translate-y-1 active:shadow-none"
                 >
                   {t('heroes.collect') || 'COLLECT!'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Capacity Full Warning */}
      {showCapacityWarning && (
        <div className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[var(--color-game-panel)] p-4 pixel-border w-full max-w-xs text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-[#e74c3c] text-sm mb-3">{t('modal.rosterFull')}</h3>
            <p className="text-gray-300 text-[8px] mb-4">
              {t('modal.rosterFullMsg', { count: heroCount, max: maxCapacity }).split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br/>}</span>)}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => { setShowCapacityWarning(false); setActiveTab('heroes'); }}
                className="pixel-button flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-[9px] pixel-border-sm"
              >
                {t('modal.goToHeroes')}
              </button>
              <button 
                onClick={() => setShowCapacityWarning(false)}
                className="pixel-button flex-1 bg-gray-600 text-white py-2 text-[9px] pixel-border-sm"
              >
                {t('modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}





      {/* Repair Modal Pop-up */}
      {showRepairModal && (
        <div className="fixed inset-0 bg-[#000000e6] flex flex-col items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1c1e29] border border-[#2a2d3b] w-full max-w-sm relative shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
            
            {/* Header */}
            <div className="bg-[#3b1f24] px-4 py-3 border-b border-[#4d252a] flex justify-between items-center shadow-md">
              <h2 className="text-[14px] font-black tracking-wider text-[#ff6b70] flex items-center gap-2 uppercase">
                <span>⚙️</span> {activeRepairType === 'all' ? t('repair.repairAllTitle') : t('repair.repairSquadTitle')} ({currentRepairBill.damagedCount}/{activeRepairType === 'all' ? heroCount : 0})
              </h2>
              <button 
                onClick={() => setShowRepairModal(false)}
                className="text-gray-300 hover:text-white hover:bg-white/10 w-8 h-8 flex items-center justify-center bg-[#251215] border-none transition-colors text-xs opacity-70 hover:opacity-100"
              >
                X
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-[#e2e8f0] text-[12px] mb-6 text-center leading-relaxed font-sans">
                {activeRepairType === 'all' 
                  ? t('repair.allDesc')
                  : t('repair.squadDesc')}
              </p>

              {/* Bill Breakdown */}
              <div className="border border-[#383d52] bg-[#0f111a] p-4 mb-6 shadow-inner relative">
                <h3 className="text-[10px] text-[#8b91a3] mb-3 border-b border-[#282c3c] pb-2 uppercase tracking-wide">{t('repair.costLabel')}</h3>
                
                <ul className="space-y-3 mt-3">
                  {currentRepairBill.breakdown.map((item, index) => (
                    <li key={index} className="flex justify-between items-center text-[13px]">
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.2)]" style={{ backgroundColor: item.color }}></span>
                        <span className="font-bold text-white ml-3 capitalize">{t(`common.${item.rarity.toLowerCase()}`)}</span> 
                        <span className="text-[#5d637a] text-[9px] ml-2 font-mono">x {item.count}</span>
                      </span>
                      <span className="text-[#89b4fa] font-mono font-bold tracking-wide">{item.totalGroupCost.toFixed(3)} TON</span>
                    </li>
                  ))}
                  {currentRepairBill.breakdown.length === 0 && (
                    <li className="text-center text-[#5d637a] italic py-3 text-xs">{t('repair.noRepairs')}</li>
                  )}
                </ul>

                {/* Total */}
                <div className="mt-5 pt-4 border-t border-[#282c3c] flex justify-between items-center">
                  <span className="text-white font-black text-[15px] uppercase tracking-wide">{t('repair.totalBill')}</span>
                  <span className="text-[#ff5555] font-black font-mono text-[16px] tracking-wider">{currentRepairBill.totalCost.toFixed(4)} TON</span>
                </div>
              </div>

              {/* Confirm Button */}
              <RepairPaymentButton 
                repairCost={currentRepairBill.totalCost}
                userId="player123"
                triggerModal={triggerModal}
                disabled={currentRepairBill.damagedCount === 0}
                onSuccess={() => {
                  repairHeroes(currentRepairBill.damagedIds);
                  setShowRepairModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Navbar */}
      <nav className="theme-nav-bg fixed bottom-0 left-0 right-0 z-50 py-1 max-w-md mx-auto shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
        <ul 
          className="flex flex-nowrap overflow-x-auto overflow-y-hidden touch-pan-x hide-scrollbar items-center h-[72px] px-2 gap-1.5 snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {[
            { id: 'gacha', icon: IconGacha, label: t('nav.gacha') },
            { id: 'raid', icon: IconBattle, label: t('nav.battle') },
            { id: 'mission', icon: IconMission, label: 'MISSION' },
            { id: 'arcade', icon: IconArcade, label: t('nav.arcade') },
            { id: 'earn', icon: IconEarn, label: t('nav.withdraw') },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id} className="min-w-[72px] h-[64px] relative snap-center">
                <button 
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full h-full flex flex-col items-center justify-center transition-all ${isActive ? 'theme-nav-tab-active' : 'hover:bg-white/5 rounded-lg'}`}
                >
                  <span className={`text-2xl mb-1.5 transition-all flex items-center justify-center ${isActive ? 'scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10' : 'theme-nav-icon-inactive scale-90'}`}>
                    <tab.icon />
                  </span>
                  <span className={`text-[8px] font-black tracking-tighter z-10 ${isActive ? 'text-[#ffcc00] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'theme-nav-text-inactive'}`}>
                    {tab.label}
                  </span>
                  {tab.badge && (
                    <span className={`absolute top-0 right-1 ${showPlusOneBadge && tab.id === 'heroes' ? 'bg-[#2ecc71] animate-bounce scale-110' : 'bg-[#e74c3c]'} text-white text-[7px] font-mono px-1.5 py-0.5 min-w-[16px] text-center rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)] border ${showPlusOneBadge && tab.id === 'heroes' ? 'border-white' : 'border-[#ff7b72]'} z-20 transition-all duration-300`}>
                      {showPlusOneBadge && tab.id === 'heroes' ? '+1' : tab.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsEditingProfile(false)}></div>
          <div className="relative w-full max-w-xs bg-[#1a1c23] border-2 border-gray-700 p-5 pixel-border shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
            <h2 className="text-yellow-400 text-sm font-bold mb-4 tracking-widest text-center border-b border-gray-800 pb-2">{t('profile.title')}</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 block">{t('profile.playerName')}</label>
                <input 
                  type="text" 
                  defaultValue={playerName}
                  id="profile-name-input"
                  maxLength={15}
                  className="w-full bg-black/40 border border-gray-700 px-3 py-2 text-white text-xs pixel-border-sm focus:border-yellow-500 outline-none transition-colors"
                  spellCheck="false"
                />
                <p className="text-[6px] text-gray-500 mt-1">{t('profile.nameHint')}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-800">
              <button 
                onClick={() => setIsEditingProfile(false)}
                className="flex-1 py-2 bg-gray-800 text-gray-400 text-[8px] pixel-border-sm hover:bg-gray-700 transition-colors"
              >
                {t('profile.cancel')}
              </button>
              <button 
                onClick={() => {
                  const input = document.getElementById('profile-name-input');
                  handleSaveProfile(input.value);
                }}
                className="flex-1 py-2 bg-yellow-500 text-black text-[8px] font-bold pixel-border-sm hover:bg-yellow-400 transition-colors"
              >
                {t('profile.save')}
              </button>
            </div>

            {/* Reset Data Button (for Dev/Server Push) */}
            <div className="mt-4 border-t border-red-900/30 pt-4">
              <button 
                onClick={resetAllData}
                className="w-full py-2 bg-red-900/20 border border-red-500/30 text-red-500 text-[7px] font-bold tracking-widest hover:bg-red-500 hover:text-white transition-all pixel-border-sm"
              >
                ☢️ RESET ACCOUNT DATA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Themed Game Modal System */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          {/* Main Container with Retro 3D Shadow */}
          <div 
            className="w-full max-w-[380px] bg-[#1a1c23] border-[3px] border-[#000] relative shadow-[8px_8px_0_0_rgba(0,0,0,0.8)] overflow-hidden animate-zoom-in"
          >
            {/* Header with Dynamic Theme */}
            <div 
              className={`px-4 py-3 border-b-[3px] border-[#000] flex items-center gap-3 ${
                modalConfig.type === 'confirm' ? 'bg-[#e74c3c]' : 'bg-[#f39c12]'
              }`}
            >
              <span className="text-xl drop-shadow-md">
                {modalConfig.type === 'confirm' ? '⚠️' : '🔔'}
              </span>
              <h3 className="text-white text-[13px] font-black tracking-widest uppercase truncate pt-0.5 drop-shadow-md">
                {modalConfig.title || (modalConfig.type === 'confirm' ? t('modal.warning') : t('modal.info'))}
              </h3>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8 bg-gradient-to-b from-[#1a1c23] to-[#12141a]">
              <p className="text-white text-[12px] sm:text-[13px] leading-relaxed font-bold tracking-wide mb-8">
                {modalConfig.message.split('\n').map((line, i) => (
                  <span key={i} className="block mb-2 last:mb-0">
                    {line}
                  </span>
                ))}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {modalConfig.type === 'confirm' && (
                  <button
                    onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                    className="flex-1 py-3 bg-[#34495e] hover:bg-[#2c3e50] text-gray-300 text-[10px] font-black tracking-widest uppercase pixel-border-sm transition-all active:scale-95"
                  >
                    {modalConfig.cancelText || t('modal.cancel')}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (modalConfig.onConfirm) modalConfig.onConfirm();
                    setModalConfig({ ...modalConfig, isOpen: false });
                  }}
                  className={`flex-1 py-3 text-white text-[10px] font-black tracking-widest uppercase pixel-border-sm transition-all animate-pulse-slow active:scale-95 ${
                    modalConfig.type === 'confirm' ? 'bg-[#e74c3c] hover:bg-[#c0392b] shadow-[0_0_15px_rgba(231,76,60,0.3)]' : 'bg-[#f1c40f] hover:bg-[#d4ac0d] !text-black shadow-[0_0_15px_rgba(241,196,15,0.3)]'
                  }`}
                >
                  {modalConfig.confirmText || (modalConfig.type === 'confirm' ? t('confirm.confirm') : t('modal.ok'))}
                </button>
              </div>
            </div>

            {/* Bottom Glow */}
            <div 
              className={`h-1 w-full opacity-50 ${
                modalConfig.type === 'confirm' ? 'bg-[#e74c3c]' : 'bg-[#f1c40f]'
              }`}
            ></div>
          </div>
        </div>
      )}
      {/* Welcome Bonus Modal (Upgraded to 3-Hero Unit Deployment) */}
      {showWelcomeModal && welcomeHeroes && welcomeHeroes.length === 3 && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#12141c] border-[3px] border-[#ffd700] w-full max-w-[420px] relative overflow-hidden shadow-[0_0_80px_rgba(255,215,0,0.2)] flex flex-col items-center">
            
            {/* Header with Glow */}
            <div className="w-full bg-[#ffd700] p-5 text-center border-b-[3px] border-black">
              <h2 className="text-black text-xl font-black tracking-[0.15em] uppercase drop-shadow-sm leading-none">
                {t('welcome.title') || "WELCOME COMMANDER!"}
              </h2>
              <p className="text-black/70 text-[9px] font-bold mt-2 uppercase tracking-widest">
                {t('welcome.freeHero') || "COMMENCING INITIAL DEPLOYMENT GIFT"}
              </p>
            </div>

            <div className="p-6 w-full">
              {/* Connection Success Info */}
              <div className="flex items-center justify-center gap-3 mb-6 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  {t('welcome.connected') || "WALLET CONNECTED"}
                </p>
              </div>

              <div className="text-white/40 text-[8px] font-bold text-center uppercase tracking-[0.3em] mb-4">
                {t('welcome.received') || "─── INCOMING 3-UNIT SQUAD ───"}
              </div>

              {/* 3-Hero Grid Preview */}
              <div className="flex justify-center gap-3 mb-8">
                 {welcomeHeroes.map((hero, idx) => (
                    <div key={idx} className="relative bg-black/40 border-2 border-[#7f8c8d]/60 p-2.5 flex flex-col items-center w-24 rounded-lg shadow-lg">
                      <div className="w-16 h-16 flex items-center justify-center mb-2">
                        <div className="w-14 h-14 transform scale-110" style={{ filter: `drop-shadow(0 0 8px ${hero.color})` }}>
                          <Sprite char={hero} />
                        </div>
                      </div>
                      <div className="text-[7px] font-black uppercase text-[#7f8c8d] tracking-widest bg-black/40 px-2 py-0.5 rounded-full">
                        {hero.rarity}
                      </div>
                    </div>
                 ))}
              </div>

              {/* Claim Button */}
              <button 
                onClick={handleClaimWelcomeGift}
                className="w-full py-4 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-[13px] font-black tracking-[0.2em] uppercase transition-all border-[4px] border-[#a78bfa] border-b-[#5b21b6] border-r-[#5b21b6] active:translate-y-1 active:shadow-none shadow-[8px_8px_0_0_#000]"
              >
                {t('welcome.claim') || "CLAIM SQUAD!"}
              </button>
            </div>

            {/* Scanline FX */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-px animate-scanline opacity-30"></div>
          </div>
        </div>
      )}

      {/* ═══════ LONG-PRESS CHARACTER STATS POPUP ═══════ */}
      {longPressHero && (
        <div 
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
        >
          <div 
            className="w-full max-w-[320px] relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_15px_rgba(59,130,246,0.2)] animate-in zoom-in-95 duration-200"
            style={{ borderColor: longPressHero.color }}
          >
            {/* Cyberpunk Neon Border Frame */}
            <div className="absolute inset-0 border-2 pointer-events-none z-30" style={{ borderColor: longPressHero.color, boxShadow: `inset 0 0 20px ${longPressHero.color}22, 0 0 20px ${longPressHero.color}33` }}></div>
            
            {/* Header Bar */}
            <div className="bg-gradient-to-r from-[#0f111a] via-[#1a1c29] to-[#0f111a] px-4 py-2.5 flex items-center justify-between border-b-2" style={{ borderColor: longPressHero.color + '66' }}>
              <div className="flex items-center gap-2">
                {/* Rarity */}
                <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 border" style={{ color: longPressHero.color, borderColor: longPressHero.color + '55', backgroundColor: longPressHero.color + '15' }}>
                  {longPressHero.rarity}
                </span>
                {/* Grade */}
                {longPressHero.grade && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 border" style={{ color: GRADE_COLORS[longPressHero.grade] || '#888', borderColor: (GRADE_COLORS[longPressHero.grade] || '#888') + '55', backgroundColor: (GRADE_COLORS[longPressHero.grade] || '#888') + '15' }}>
                    GRADE {longPressHero.grade}
                  </span>
                )}
              </div>
               {/* Element removed */}
              <div className="flex items-center gap-1.5">
              </div>
            </div>

            {/* Body */}
            <div className="bg-gradient-to-br from-[#0d0f18] via-[#141622] to-[#0d0f18] p-4 flex gap-4 items-center">
              {/* Left: Robot Sprite */}
              <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center pixel-border-sm relative overflow-hidden" style={{ backgroundColor: longPressHero.imageColor, borderColor: longPressHero.color }}>
                <div className="w-20 h-20">
                  <Sprite char={longPressHero} />
                </div>
                {/* Level Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 flex flex-col items-center py-0.5">
                  <div className="flex gap-0.5 mb-0.5">
                    {Array.from({ length: longPressHero.level || 1 }).map((_, idx) => (
                      <span key={idx} className="text-[#f1c40f] text-[7px] leading-none">★</span>
                    ))}
                  </div>
                  <span className="text-[7px] text-gray-400 font-bold leading-none">Lv.{longPressHero.level || 1}</span>
                </div>
              </div>

              {/* Right: Stats Panel */}
              <div className="flex-1 flex flex-col gap-1.5">
                {/* Name */}
                <div className="text-[9px] font-bold text-white truncate mb-1 tracking-wide">{longPressHero.name}</div>
                
                {/* Stats */}
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1.5 border-l-2 border-red-500">
                  <span className="text-[10px]">❤️</span>
                  <span className="text-[7px] text-gray-500 font-bold w-6">HP</span>
                  <span className="text-[9px] text-white font-black flex-1 text-right">{longPressHero.hp?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1.5 border-l-2 border-orange-500">
                  <span className="text-[10px]">⚔️</span>
                  <span className="text-[7px] text-gray-500 font-bold w-6">ATK</span>
                  <span className="text-[9px] text-white font-black flex-1 text-right">{longPressHero.atk}</span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1.5 border-l-2 border-blue-500">
                  <span className="text-[10px]">🛡️</span>
                  <span className="text-[7px] text-gray-500 font-bold w-6">DEF</span>
                  <span className="text-[9px] text-white font-black flex-1 text-right">{longPressHero.def}</span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1.5 border-l-2 border-emerald-500">
                  <span className="text-[10px]">👟</span>
                  <span className="text-[7px] text-gray-500 font-bold w-6">SPD</span>
                  <span className="text-[9px] text-white font-black flex-1 text-right">{longPressHero.spd}</span>
                </div>
              </div>
            </div>

            {/* Footer Hint */}
            <div className="bg-[#0a0b12] text-center py-1.5 border-t border-white/5">
              <span className="text-[6px] text-gray-600 tracking-widest uppercase">Release to close</span>
            </div>
          </div>
        </div>
      )}
      {/* ═══════ Transaction Processing Overlay ═══════ */}
      {isProcessingPayment && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="relative w-24 h-24 mb-8">
             <div className="absolute inset-0 border-4 border-[#facc15]/20 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-t-[#facc15] rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <IconTon className="w-10 h-10 animate-pulse" />
             </div>
          </div>
          
          <h2 className="text-[#facc15] text-xl font-black tracking-[0.2em] uppercase mb-2 animate-glitch text-center">
            Transmitting...
          </h2>
          <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase text-center max-w-[200px] leading-relaxed">
            Please confirm the transaction in your wallet app
          </p>
          
          <div className="mt-8 px-4 py-2 border border-white/10 bg-white/5 rounded text-[8px] font-mono text-gray-500 max-w-[240px] truncate">
            TO: {paymentRecipient || RECIPIENT_ADDRESS}
          </div>
        </div>
      )}

      {/* ═══════ Payment Error Modal ═══════ */}
      {paymentError && (
        <div className="fixed inset-0 z-[1001] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a0b0b] border-4 border-[#ff4444] p-6 w-full max-w-[320px] relative shadow-[10px_10px_0_0_#4a0000]">
             <h3 className="text-[#ff4444] text-lg font-black uppercase mb-4 tracking-tighter">Transaction Failed</h3>
             <p className="text-white/80 text-[10px] font-bold mb-6 leading-relaxed uppercase">{paymentError}</p>
             <button 
               onClick={() => setPaymentError(null)}
               className="w-full bg-[#ff4444] text-white py-3 font-black uppercase text-[11px] tracking-widest hover:bg-[#ff6666] transition-colors"
             >
               Dismiss
             </button>
          </div>
        </div>
      )}
      {/* Rich Success Notification Overlays */}
      {successNotification && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSuccessNotification(null)}></div>
           
           {/* Modal Body */}
           <div className={`relative w-full max-w-sm ${successNotification.type === 'deposit' ? 'bg-[#0f1a14] border-emerald-500/50' : 'bg-[#0a121a] border-blue-500/50'} border-[3px] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden`}>
              
              {/* Header Title with Animated Decoration */}
              <div className={`px-5 py-4 border-b-[3px] border-black/20 flex items-center gap-3 ${successNotification.type === 'deposit' ? 'bg-[#10b981]' : 'bg-[#3b82f6]'}`}>
                 <span className="text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] animate-bounce-slow">✅</span>
                 <h2 className="text-white text-[14px] font-black tracking-[0.1em] uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)] pt-1">
                    {successNotification.type === 'deposit' ? t('notification.depositConfirmed') : t('notification.withdrawalApproved')}
                 </h2>
              </div>

              {/* Content Container */}
              <div className="p-6 bg-gradient-to-b from-black/20 to-transparent">
                 {successNotification.type === 'deposit' ? (
                   /* DEPOSIT CONTENT */
                   <div className="space-y-4">
                      {/* Breakdown List */}
                      <div className="space-y-2 font-bold tracking-wide">
                         <div className="flex items-center gap-4 text-emerald-400">
                            <span className="text-2xl drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">💰</span>
                            <span className="text-[12px] flex-1">+{successNotification.amount.toFixed(4)} TON {t('notification.addedToBalance')}</span>
                         </div>
                         <div className="flex items-center gap-4 text-yellow-400">
                            <span className="text-2xl drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">🎁</span>
                            <span className="text-[11px] flex-1">{t('notification.promoBonus')}: +{successNotification.bonus.toFixed(4)} TON (20% extra!)</span>
                         </div>
                         <div className="flex items-center gap-4 text-white/50 border-t border-white/5 pt-2">
                            <span className="text-lg opacity-60">💼</span>
                            <span className="text-[10px] flex-1">{t('notification.totalCredited')}: {successNotification.total.toFixed(4)} TON</span>
                         </div>
                         <div className="flex items-center gap-4 text-white">
                            <span className="text-lg opacity-60">💼</span>
                            <span className="text-[11px] flex-1">{t('notification.newBalance')}: <span className="text-emerald-400">{successNotification.newBalance.toFixed(4)} TON</span></span>
                         </div>
                      </div>

                      <p className="text-gray-500 text-[9px] font-bold text-center mt-6 tracking-widest uppercase opacity-80 decoration-emerald-500/20 underline underline-offset-4">
                         {t('notification.keepUpgrading')} 🏰
                      </p>
                   </div>
                 ) : (
                   /* WITHDRAWAL CONTENT */
                   <div className="space-y-5">
                      <div className="space-y-3 font-bold tracking-wide">
                         <div className="flex items-center gap-4 text-blue-400">
                            <span className="text-2xl">💸</span>
                            <span className="text-[12px] flex-1">{successNotification.amount.toFixed(4)} TON {t('notification.sentToWallet')}</span>
                         </div>
                         
                         {/* Transaction Preview Card */}
                         <div className="bg-black/60 border border-white/5 p-4 rounded-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-20"><span className="text-3xl">🔍</span></div>
                            <div className="text-[9px] text-[#3b82f6] font-mono mb-2 border-b border-white/5 pb-1 flex justify-between">
                              <span>tonscan.org</span>
                              <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                            <div className="text-[11px] text-white flex items-center justify-between">
                               <span>{successNotification.txId} · Transaction</span>
                               <span className="bg-[#10b981]/20 text-[#10b981] text-[7px] px-1.5 py-0.5 rounded border border-[#10b981]/30">Success</span>
                            </div>
                            <div className="text-[8px] text-gray-500 mt-1 leading-tight max-w-[200px]">
                               Address {successNotification.address.substring(0, 8)}... sent {successNotification.net.toFixed(2)} TON to you.
                            </div>
                         </div>

                         <div className="flex items-center gap-2 mt-2 px-1">
                            <span className="text-blue-500 text-lg">🔗</span>
                            <button className="text-[#3b82f6] hover:text-white transition-colors text-[9px] underline decoration-blue-500/40 underline-offset-4">
                               {t('notification.viewTransaction')}
                            </button>
                         </div>
                      </div>

                      <p className="text-gray-500 text-[9px] font-bold text-center mt-4 tracking-widest uppercase">
                         {t('notification.thankYou')} 🤖
                      </p>
                   </div>
                 )}

                 {/* Confirm Button */}
                 <button 
                   onClick={() => setSuccessNotification(null)}
                   className={`w-full mt-8 py-4 text-[13px] font-black tracking-widest ${successNotification.type === 'deposit' ? 'bg-[#10b981] hover:bg-[#059669]' : 'bg-[#3b82f6] hover:bg-[#2563eb]'} text-black transition-all border-b-4 border-black/40 active:translate-y-1 active:border-b-0`}
                 >
                   OK
                 </button>
              </div>
           </div>
        </div>
      )}
      {/* Mandatory Name Change Overlay */}
      {showNameMandatory && (
        <div className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="w-full max-w-sm bg-[#0a0c10] border-[4px] border-[#ffd700] shadow-[0_0_100px_rgba(255,215,0,0.15)] relative overflow-hidden flex flex-col items-center p-8">
            {/* Decal background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.2) 0%,transparent 70%)]"></div>
               <div className="grid grid-cols-10 h-full w-full">
                  {Array.from({length: 40}).map((_, i) => (
                    <div key={i} className="border border-white/5 h-10 w-full text-[10px] flex items-center justify-center opacity-10">01</div>
                  ))}
               </div>
            </div>

            {/* Header */}
            <div className="relative z-10 w-full mb-8 text-center">
              <div className="bg-[#ffd700] inline-block px-4 py-1 mb-4">
                 <span className="text-black text-xs font-black tracking-widest uppercase">PIXEL WAR SYSTEM</span>
              </div>
              <h2 className="text-white text-xl font-black tracking-[0.2em] uppercase mb-4 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                 {t('profile.mandatoryTitle')}
              </h2>
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#ffd700] to-transparent opacity-50 mb-4"></div>
              <p className="text-gray-400 text-[10px] font-bold leading-relaxed tracking-wider px-2">
                 {t('profile.mandatoryDesc')}
              </p>
            </div>

            {/* Input Field */}
            <div className="relative z-10 w-full mb-10">
               <div className="absolute -top-3 left-4 bg-[#0a0c10] px-2 text-[8px] text-[#ffd700] font-bold tracking-widest uppercase z-20">
                  CODENAME INPUT
               </div>
               <input 
                 autoFocus
                 type="text"
                 value={tempName}
                 maxLength={15}
                 onChange={(e) => setTempName(e.target.value)}
                 placeholder="COMMANDER NAME..."
                 className="w-full bg-black/60 border-2 border-[#ffd700]/30 p-4 text-[#ffd700] text-center font-black tracking-widest focus:border-[#ffd700] outline-none transition-all placeholder:text-[#ffd700]/10"
               />
               <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-[7px] text-gray-500 font-bold italic">{t('profile.minChars')}</span>
                  <span className={`text-[8px] font-mono font-bold ${tempName.length >= 3 ? 'text-[#ffd700]' : 'text-red-500'}`}>
                    {tempName.length}/15
                  </span>
               </div>
            </div>

            {/* Submit Button */}
            <button 
              disabled={tempName.trim().length < 3}
              onClick={() => handleSaveProfile(tempName)}
              className={`relative z-10 w-full py-5 font-black tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 active:translate-y-1 ${
                tempName.trim().length >= 3 
                ? 'bg-[#ffd700] hover:bg-[#ffed4a] text-black shadow-[0_5px_0_#9a8100]' 
                : 'bg-gray-800 text-gray-600 grayscale cursor-not-allowed border-none'
              }`}
            >
              🚀 {t('profile.commence')}
            </button>

            {/* Decorative bottom barcode */}
            <div className="mt-8 relative z-10 opacity-30 flex gap-0.5">
               {Array.from({length: 20}).map((_, i) => (
                 <div key={i} className="bg-white h-4" style={{ width: Math.random() > 0.5 ? '2px' : '4px' }}></div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
