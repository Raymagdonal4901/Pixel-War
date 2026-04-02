import React, { useState } from 'react';
import { useT } from '../i18n/LanguageContext';

const IconRobotSil = ({ className = "w-4 h-4", color = "currentColor" }) => (
  <svg className={className} viewBox="0 0 16 16" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }}>
    <path d="M4 2H12V4H14V10H12V12H4V10H2V4H4V2Z" />
    <path d="M5 5H7V7H5V5Z" fill="black" fillOpacity="0.3" />
    <path d="M9 5H11V7H9V5Z" fill="black" fillOpacity="0.3" />
    <path d="M2 5H1V8H2V5Z" />
    <path d="M14 5H15V8H14V5Z" />
    <path d="M6 12H10V14H6V12Z" />
  </svg>
);

const ReferralHub = ({ referralData, onClaim, balance }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useT();

  // If referralData is missing for some reason, we avoid crashing
  const stats = referralData || {
    tier1: { count: 0, earned: 0 },
    tier2: { count: 0, earned: 0 },
    tier3: { count: 0, earned: 0 },
    unclaimed: 0,
    totalEarned: 0,
    refLink: 'pixelwar.io/ref/User123'
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(stats.refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 p-4 animate-in fade-in relative min-h-full no-scrollbar overflow-y-auto">
      {/* ─── HEADER ─── */}
      <div className="text-center mb-6 pt-2">
        <h2 className="text-[18px] font-black tracking-[0.2em] text-[#4ade80] drop-shadow-[0_0_10px_rgba(74,222,128,0.5)] uppercase animate-pulse">
           {t('referral.title')}
        </h2>
        <div className="h-0.5 w-16 bg-[#4ade80] mx-auto mt-2 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
      </div>

      {/* ─── YOUR LINK ─── */}
      <section className="mb-6">
        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1 mb-2 block">
          {t('referral.yourLink')}
        </label>
        <div className="bg-[#0f172a] border-2 border-[#10b981] p-1.5 flex items-center justify-between rounded-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
          <div className="px-3 text-[10px] text-[#4ade80] font-mono truncate">{stats.refLink}</div>
          <button 
            onClick={handleCopy}
            className={`min-w-[100px] h-10 relative overflow-hidden transition-all active:scale-95 text-[11px] font-black tracking-widest ${copied ? 'bg-[#10b981] text-white' : 'text-black bg-[#facc15]'} pixel-border-sm border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 shadow-lg`}
          >
            {copied ? 'COPIED!' : 'COPY'}
          </button>
        </div>
      </section>

      {/* ─── MY NETWORK ─── */}
      <section className="mb-6 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-yellow-400 text-[10px] uppercase font-black tracking-widest border-l-4 border-yellow-400 pl-2">
            {t('referral.network')}
          </h3>
        </div>

        <div className="space-y-3">
          {/* Tier 1 */}
          <div className="bg-[#1e293b]/60 border-2 border-[#334155] p-3 rounded-xl flex items-center justify-between relative overflow-hidden group hover:border-[#facc15] transition-colors">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 bg-[#facc15] rounded-lg flex items-center justify-center text-black text-[20px] font-black shadow-[0_4px_0_#ca8a04] group-hover:scale-110 transition-transform">🥇</div>
              <div className="flex flex-col">
                <span className="text-white font-black tracking-wider text-[11px] mb-0.5">Tier 1 (เพื่อนตรง)</span>
                <span className="text-gray-400 text-[9px] font-mono leading-none">{stats.tier1.count} FRIENDS / 10%</span>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-gray-500 text-[8px] block font-bold mb-1 uppercase tracking-tighter">Earnings</span>
              <span className="text-[#4ade80] font-black text-xs block font-mono">{stats.tier1.earned.toFixed(4)} TON</span>
            </div>
            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] rotate-[-15deg] group-hover:opacity-[0.08] transition-opacity">
               <IconRobotSil className="w-24 h-24" color="white" />
            </div>
          </div>

          {/* Tier 2 */}
          <div className="bg-[#1e293b]/60 border-2 border-[#334155] p-3 rounded-xl flex items-center justify-between relative overflow-hidden group hover:border-gray-400 transition-colors">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 bg-gray-400 rounded-lg flex items-center justify-center text-black text-[20px] font-black shadow-[0_4px_0_#6b7280] group-hover:scale-110 transition-transform">🥈</div>
              <div className="flex flex-col">
                <span className="text-white font-black tracking-wider text-[11px] mb-0.5">Tier 2 (เพื่อนของเพื่อน)</span>
                <span className="text-gray-400 text-[9px] font-mono leading-none">{stats.tier2.count} FRIENDS / 5%</span>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-gray-500 text-[8px] block font-bold mb-1 uppercase tracking-tighter">Earnings</span>
              <span className="text-[#4ade80] font-black text-xs block font-mono">{stats.tier2.earned.toFixed(4)} TON</span>
            </div>
            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] rotate-[15deg] group-hover:opacity-[0.08] transition-opacity">
               <IconRobotSil className="w-24 h-24" color="white" />
            </div>
          </div>

          {/* Tier 3 */}
          <div className="bg-[#1e293b]/60 border-2 border-[#334155] p-3 rounded-xl flex items-center justify-between relative overflow-hidden group hover:border-[#cd7f32] transition-colors">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 bg-[#cd7f32] rounded-lg flex items-center justify-center text-white text-[20px] font-black shadow-[0_4px_0_#8b4513] group-hover:scale-110 transition-transform">🥉</div>
              <div className="flex flex-col">
                <span className="text-white font-black tracking-wider text-[11px] mb-0.5">Tier 3 (ชั้นหลาน)</span>
                <span className="text-gray-400 text-[9px] font-mono leading-none">{stats.tier3.count} FRIENDS / 2%</span>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-gray-500 text-[8px] block font-bold mb-1 uppercase tracking-tighter">Earnings</span>
              <span className="text-[#4ade80] font-black text-xs block font-mono">{stats.tier3.earned.toFixed(4)} TON</span>
            </div>
            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] rotate-[-10deg] group-hover:opacity-[0.08] transition-opacity">
               <IconRobotSil className="w-24 h-24" color="white" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLAIM SECTION ─── */}
      <section className="mt-auto pb-4">
        <div className="bg-[#020617] border-2 border-[#4ade80] p-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-b from-[#4ade80] via-transparent to-[#4ade80] h-px animate-scanline"></div>
          
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-end px-1">
               <div className="flex flex-col">
                 <p className="text-gray-400 text-[9px] uppercase font-black tracking-widest">{t('referral.unclaimed')}</p>
                 <p className="text-[#4ade80] text-2xl font-black drop-shadow-[0_0_15px_rgba(74,222,128,0.6)]">{stats.unclaimed.toFixed(4)} <span className="text-[10px]">TON</span></p>
               </div>
               <div className="text-right">
                 <p className="text-gray-500 text-[8px] uppercase font-bold tracking-tighter">Current Balance</p>
                 <p className="text-white text-[10px] font-bold font-mono">{balance.toFixed(2)} TON</p>
               </div>
            </div>

            <button 
              disabled={stats.unclaimed <= 0}
              onClick={() => {
                const claimed = onClaim();
                if (claimed > 0) {
                  alert(`Claimed ${claimed.toFixed(4)} TON!`);
                }
              }}
              className="w-full h-14 bg-[#10b981] hover:bg-[#059669] text-black font-black tracking-[0.3em] text-[15px] rounded-xl transition-all shadow-[0_10px_20px_rgba(34,197,94,0.3)] active:translate-y-1 active:shadow-none disabled:opacity-30 disabled:grayscale uppercase border-b-4 border-green-900"
            >
              {t('referral.claim')}
            </button>
          </div>
        </div>
      </section>

      <div className="fixed inset-0 pointer-events-none z-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(74,222,128,0.2) 1px, rgba(74,222,128,0.2) 2px)' }}></div>
    </div>
  );
}

export default ReferralHub;
