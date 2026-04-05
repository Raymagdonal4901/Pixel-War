import React from 'react';
import { useT } from '../i18n/LanguageContext';

const IconScrap = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
    <rect x="2" y="4" width="8" height="8" fill="#555" />
    <rect x="6" y="2" width="6" height="6" fill="#777" />
    <rect x="4" y="6" width="2" height="2" fill="#333" />
    <rect x="8" y="4" width="2" height="2" fill="#999" />
  </svg>
);

const IconMechBox = ({ className = "w-10 h-10" }) => (
  <div className={`relative ${className} flex items-center justify-center animate-pulse`}>
    <div className="absolute inset-0 bg-[#f1c40f]/20 blur-sm rounded-lg"></div>
    <img src="/gacha_icon.png" alt="Box" className="w-full h-full object-contain image-pixelated drop-shadow-[0_0_8px_rgba(241,196,15,0.6)]" />
  </div>
);

const EarnFreeMech = ({ missionData, onOpenBox, triggerModal, navigateToTab }) => {
  const { t } = useT();
  const { scrap, streak, mechTickets, completedTasks, canCheckIn, checkIn, completeTask, craft } = missionData;

  const days = Array.from({ length: 7 }).map((_, i) => {
    const isFirstDay = i === 0;
    const isClaimed = streak > i + 1 || (streak === i + 1 && !canCheckIn);
    const isCurrent = (streak === i && canCheckIn) || (isFirstDay && streak === 0);

    return {
      day: i + 1,
      reward: i === 6 ? 'COMMON BOX' : (i < 3 ? '5 SCRAP' : '10 SCRAP'),
      rewardLabel: i === 6 ? 'COMMON BOX' : `${i < 3 ? 5 : 10} SCRAP`,
      isClaimed,
      isCurrent
    };
  });

  const tasks = [
    { id: 'tg_join', title: 'Join Group: Official Telegram', reward: '15 SCRAP', btnColor: 'bg-[#24A1DE]', icon: '📱' },
    { id: 'x_follow', title: 'PLAY ARCADE ARENA ONCE', reward: '1 COMMON BOX', btnColor: 'bg-black', icon: '🎮' },
    { id: 'invite_3', title: 'Invite 3 Friends', reward: '1 COMMON BOX', btnColor: 'bg-[#2ecc71]', icon: '🤝' },
  ];

  const handleTaskClick = (task) => {
    if (completedTasks.includes(task.id)) return;
    
    // In a real app, window.open(link) then completeTask(task.id)
    const links = {
        'tg_join': 'https://t.me/+Lgxb1b-EEbdmODI1',
        'x_follow': '#',
        'invite_3': '#'
    };

    if (task.id === 'x_follow') {
        if (navigateToTab) {
            navigateToTab('arcade');
        } else {
            window.open(links[task.id], '_blank');
        }
        completeTask(task.id);
    } else if (task.id !== 'invite_3') {
        window.open(links[task.id], '_blank');
        completeTask(task.id);
    } else {
        triggerModal({
            type: 'alert',
            title: 'INVITE MISSION',
            message: 'Share your referral link with 3 friends to claim!',
            confirmText: 'OK'
        });
    }
  };

  return (
    <div className="flex flex-col flex-1 p-2 animate-in fade-in relative min-h-full no-scrollbar overflow-y-auto">
      
      {/* ─── DAILY CHECK-IN ─── */}
      <section className="mb-6">
        <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="text-[#f1c40f] text-[10px] font-black uppercase tracking-[0.2em]">{t('mission.loginTitle') || '7-Day Daily Login'}</h3>
          <span className="text-gray-500 text-[8px] font-bold">Streak: <span className="text-[#f1c40f]">{streak}/7</span></span>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {days.slice(0, 7).map((d) => (
            <div 
              key={d.day}
              className={`p-1.5 flex flex-col items-center justify-between h-20 rounded border-2 transition-all relative overflow-hidden ${
                d.isClaimed ? 'bg-[#1a1c23]/40 border-emerald-500/30' :
                d.isCurrent ? 'bg-[#f59e0b]/10 border-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.35)]' :
                'bg-black/60 border-gray-800'
              } ${d.day === 7 ? 'col-span-2' : ''}`}
            >
              <span className={`text-[8px] font-black uppercase tracking-tighter ${d.isClaimed ? 'text-emerald-500' : d.isCurrent ? 'text-[#fbbf24]' : 'text-gray-500'}`}>DAY {d.day}</span>
              
              <div className="flex-1 flex items-center justify-center py-1">
                {d.day === 7 ? <IconMechBox className="w-12 h-12" /> : <IconScrap />}
              </div>

              <div className={`text-[9px] font-black text-center leading-none ${d.day === 7 ? 'text-[#f1c40f]' : 'text-gray-400'}`}>
                {d.reward}
              </div>
              {d.isCurrent && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded">
                  <span className="text-[10px] font-black text-[#fbbf24] uppercase tracking-[0.2em] mb-1">Reward</span>
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-2">{d.rewardLabel}</span>
                  <button 
                    onClick={checkIn}
                    className="px-3 py-1.5 bg-[#f1c40f] text-black text-[10px] font-black uppercase tracking-[0.2em] rounded shadow-lg hover:bg-[#ffcc00] transition-colors"
                  >
                    {t('mission.claim') || 'CLAIM'}
                  </button>
                </div>
              )}
              
              {d.isClaimed && <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[6px] px-1 font-black rounded rotate-12">GOT</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ─── SOCIAL TASKS ─── */}
      <section className="mb-6 flex-1">
        <h3 className="text-purple-400 text-[10px] uppercase font-black tracking-[0.2em] mb-4 border-l-2 border-purple-400 pl-3">
          {t('mission.socialTitle') || 'Social Missions'}
        </h3>

        <div className="space-y-2 px-1">
          {tasks.map(task => {
            const isDone = completedTasks.includes(task.id);
            return (
              <div key={task.id} className="bg-[#1e293b]/40 border border-white/5 p-2 rounded-lg flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-black/40 rounded flex items-center justify-center text-lg">{task.icon}</div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-black tracking-wider text-[9px] leading-tight break-words max-w-[180px]">{task.title}</span>
                    <span className="text-[#f1c40f] text-[8px] font-mono leading-none uppercase">{task.reward}</span>
                  </div>
                </div>
                <button 
                  disabled={isDone}
                  onClick={() => handleTaskClick(task)}
                  className={`min-w-[70px] h-9 text-[10px] font-black tracking-widest uppercase transition-all ${
                    isDone ? 'bg-gray-800 text-gray-500 cursor-default' : `${task.btnColor} text-white hover:scale-105 active:scale-95 shadow-lg`
                  } rounded-lg border-b-2 ${isDone ? 'border-gray-900' : 'border-black/50'}`}
                >
                  {isDone ? t('mission.claimed') || 'CLAIMED' : t('mission.claim') || 'CLAIM'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CRAFTING & SCRAP FOOTER ─── */}
      <section className="mt-auto pb-4 px-1">
        <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border-2 border-indigo-500/40 p-3 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/gacha_bg.jpg')] opacity-[0.05] mix-blend-overlay"></div>
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex justify-between items-end px-1">
               <div className="flex flex-col">
                 <p className="text-gray-400 text-[8px] uppercase font-black tracking-widest mb-1 leading-none">{t('mission.scrapTitle') || 'Your Scrap Metal'}</p>
                 <div className="flex items-center gap-1.5">
                   <IconScrap />
                   <p className="text-[#f1c40f] text-xl font-black drop-shadow-[0_0_8px_rgba(241,196,15,0.4)] font-mono leading-none">{scrap}</p>
                 </div>
               </div>
               
               {mechTickets > 0 && (
                 <button 
                   onClick={() => {
                        triggerModal({
                            type: 'confirm',
                            title: 'OPEN COMMON BOX?',
                            message: 'Are you sure you want to open your Common Mech Box?',
                            confirmText: 'OPEN NOW',
                            onConfirm: onOpenBox
                        });
                   }}
                   className="flex items-center gap-1 bg-[#1a1c23] border border-emerald-500/50 p-1 px-2 rounded group hover:border-emerald-400"
                 >
                   <IconMechBox className="w-5 h-5" />
                   <span className="text-emerald-500 text-[10px] font-black tracking-tighter">HAVE {mechTickets}</span>
                 </button>
               )}
            </div>

            <div className="w-full h-3 bg-black/40 rounded-full border border-white/5 relative overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(129,140,248,0.5)] transition-all duration-1000"
                    style={{ width: `${Math.min(100, (scrap / 50) * 100)}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white mix-blend-difference">{scrap}/50</div>
            </div>

            <button 
              disabled={scrap < 50}
              onClick={craft}
              className={`w-full h-12 font-black tracking-[0.3em] text-[12px] rounded-xl transition-all border-b-4 uppercase ${
                scrap >= 50 
                  ? 'bg-gradient-to-b from-indigo-500 to-blue-600 text-white border-blue-800 hover:scale-[1.02] active:translate-y-1' 
                  : 'bg-gray-800 text-gray-500 border-gray-900 cursor-not-allowed opacity-50'
              }`}
            >
              {scrap < 50 ? (t('mission.notEnough') || 'NOT ENOUGH SCRAP') : (t('mission.craftBtn') || 'CRAFT COMMON MECH')}
            </button>
          </div>
        </div>
      </section>

      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, #818cf8 1px, #818cf8 2px)' }}></div>
    </div>
  );
}

export default EarnFreeMech;
