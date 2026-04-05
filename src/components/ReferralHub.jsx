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

const ReferralHub = ({ referralData, onClaim, balance, triggerModal, resetReferrals }) => {
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
    <div className="flex flex-col flex-1 p-2 animate-in fade-in relative min-h-full no-scrollbar overflow-y-auto">
      {/* ─── HEADER ─── */}
      <div className="text-center mb-3 pt-1 relative">
        <h2 className="text-[14px] font-black tracking-[0.2em] text-[#4ade80] drop-shadow-[0_0_8px_rgba(74,222,128,0.4)] uppercase animate-pulse">
           {t('referral.title')}
        </h2>
        <div className="h-0.5 w-12 bg-[#4ade80] mx-auto mt-1 shadow-[0_0_6px_rgba(74,222,128,0.6)]"></div>
      </div>

      {/* ─── YOUR LINK ─── */}
      <section className="mb-3">
        <label className="text-[8px] text-gray-500 font-black uppercase tracking-widest ml-1 mb-1 block">
          {t('referral.yourLink')}
        </label>
        <div className="bg-[#0f172a] border border-[#10b981]/50 p-1 flex items-center justify-between rounded-lg">
          <div className="px-2 text-[8px] text-[#4ade80] font-mono truncate">{stats.refLink}</div>
          <button 
            onClick={handleCopy}
            className={`min-w-[80px] h-8 relative overflow-hidden transition-all active:scale-95 text-[9px] font-black tracking-widest ${copied ? 'bg-[#10b981] text-white' : 'text-black bg-[#facc15]'} border-b-2 border-yellow-700 active:border-b-0 uppercase`}
          >
            {copied ? 'COPIED!' : 'COPY'}
          </button>
        </div>
      </section>

      {/* ─── MY NETWORK ─── */}
      <section className="mb-3 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="text-yellow-400 text-[9px] uppercase font-black tracking-widest border-l-2 border-yellow-400 pl-2">
            {t('referral.network')}
          </h3>
        </div>

        <div className="space-y-2">
          {/* Tier 1 */}
          <div className="bg-[#1e293b]/40 border border-white/5 p-2 rounded-lg flex items-center justify-between relative overflow-hidden group">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 h-8 bg-[#facc15] rounded flex items-center justify-center text-black text-[14px] font-black shadow-[0_2px_0_#ca8a04]">🥇</div>
              <div className="flex flex-col">
                <span className="text-white font-black tracking-wider text-[9px] mb-0.5">Tier 1 (เพื่อนตรง)</span>
                <span className="text-gray-500 text-[8px] font-mono leading-none">{stats.tier1.count} FRIENDS / 10%</span>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-gray-600 text-[6px] block font-bold mb-0.5 uppercase tracking-tighter">Earnings</span>
              <span className="text-[#4ade80] font-black text-[10px] block font-mono">{stats.tier1.earned.toFixed(4)} TON</span>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="bg-[#1e293b]/40 border border-white/5 p-2 rounded-lg flex items-center justify-between relative overflow-hidden group">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 h-8 bg-gray-400 rounded flex items-center justify-center text-black text-[14px] font-black shadow-[0_2px_0_#6b7280]">🥈</div>
              <div className="flex flex-col">
                <span className="text-white font-black tracking-wider text-[9px] mb-0.5">Tier 2 (เพื่อนของเพื่อน)</span>
                <span className="text-gray-500 text-[8px] font-mono leading-none">{stats.tier2.count} FRIENDS / 5%</span>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-gray-600 text-[6px] block font-bold mb-0.5 uppercase tracking-tighter">Earnings</span>
              <span className="text-[#4ade80] font-black text-[10px] block font-mono">{stats.tier2.earned.toFixed(4)} TON</span>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="bg-[#1e293b]/40 border border-white/5 p-2 rounded-lg flex items-center justify-between relative overflow-hidden group">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 h-8 bg-[#cd7f32] rounded flex items-center justify-center text-white text-[14px] font-black shadow-[0_2px_0_#8b4513]">🥉</div>
              <div className="flex flex-col">
                <span className="text-white font-black tracking-wider text-[9px] mb-0.5">Tier 3 (ชั้นหลาน)</span>
                <span className="text-gray-500 text-[8px] font-mono leading-none">{stats.tier3.count} FRIENDS / 2%</span>
              </div>
            </div>
            <div className="text-right relative z-10">
              <span className="text-gray-600 text-[6px] block font-bold mb-0.5 uppercase tracking-tighter">Earnings</span>
              <span className="text-[#4ade80] font-black text-[10px] block font-mono">{stats.tier3.earned.toFixed(4)} TON</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLAIM SECTION ─── */}
      <section className="mt-auto pb-2">
        <div className="bg-[#020617] border border-[#4ade80]/50 p-3 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-b from-[#4ade80] via-transparent to-[#4ade80] h-px animate-scanline"></div>
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex justify-between items-end px-1">
               <div className="flex flex-col">
                 <p className="text-gray-500 text-[8px] uppercase font-black tracking-widest">{t('referral.unclaimed')}</p>
                 <p className="text-[#4ade80] text-xl font-black drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]">{stats.unclaimed.toFixed(4)} <span className="text-[8px]">TON</span></p>
               </div>
               <div className="text-right">
                 <p className="text-gray-600 text-[7px] uppercase font-bold tracking-tighter">Current Balance</p>
                 <p className="text-white text-[9px] font-bold font-mono">{balance.toFixed(2)} TON</p>
               </div>
            </div>

            <button 
              disabled={stats.unclaimed <= 0}
              onClick={() => {
                const claimed = onClaim();
                if (claimed > 0) {
                  triggerModal({
                    type: 'alert',
                    title: t('modal.success'),
                    message: `Claimed ${claimed.toFixed(4)} TON!`,
                    confirmText: t('modal.understood')
                  });
                }
              }}
              className="w-full h-11 bg-[#10b981] hover:bg-[#059669] text-black font-black tracking-[0.2em] text-[12px] rounded-lg transition-all active:translate-y-0.5 disabled:opacity-30 disabled:grayscale uppercase border-b-2 border-green-900"
            >
              {t('referral.claim')}
            </button>

            {/* Reset Stats (Dev Only/Server Push) */}
            <div className="flex justify-center">
              <button 
                onClick={() => {
                  triggerModal({
                    type: 'confirm',
                    title: '⚠️ RESET STATS',
                    message: 'Are you sure you want to reset all referral stats to 0?',
                    confirmText: 'RESET',
                    onConfirm: resetReferrals
                  });
                }}
                className="text-[6px] text-gray-600 hover:text-red-400 font-bold tracking-widest uppercase underline underline-offset-2"
              >
                Reset Statistics
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="fixed inset-0 pointer-events-none z-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(74,222,128,0.2) 1px, rgba(74,222,128,0.2) 2px)' }}></div>
    </div>
  );
}

export default ReferralHub;
