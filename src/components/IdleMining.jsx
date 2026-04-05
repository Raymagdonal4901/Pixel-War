import React, { useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import Sprite from './Sprite';
import { BASE_RATE_PER_ATK, MINING_RECHARGE_FEE, TIER_PRICING, BOSSES } from '../data/tokenomics';

const TIER_TO_RARITY = { 1: 'Common', 2: 'Rare', 3: 'SR', 4: 'Epic', 5: 'Legendary' };

function IdleMining({ 
  miningData, 
  userHeroes, 
  triggerModal,
  onClaim
}) {
  const { t } = useT();
  const { miningState, claimYield, unlockPod, removeMech, rechargeSlot } = miningData;
  const [showAssignModal, setShowAssignModal] = useState(null); // podId

  const { currentBossIndex, zones } = miningState;
  const activeZone = zones.find(z => z.bossIndex === currentBossIndex);
  const currentBoss = BOSSES[currentBossIndex];
  
  if (!activeZone || !currentBoss) return null;

  // Show only this zone's yield at the top as requested
  const zoneYield = activeZone.pendingYield || 0;
  const globalTotal = miningState.pendingYield || 0;
  const formattedYield = zoneYield.toFixed(6);

  const handleClaim = () => {
    if (globalTotal <= 0) return;
    const amount = claimYield();
    if (onClaim) {
      onClaim(amount);
    }
  };

  const handleUnlock = async (pod) => {
    triggerModal({
      type: 'confirm',
      title: t('mining.unlockPod'),
      message: `${t('mining.unlockConfirm')} ${pod.unlockCost} TON`,
      confirmText: 'UNLOCK',
      onConfirm: () => {
        unlockPod(pod.id);
      }
    });
  };

  const handleRechargeSlot = (pod) => {
    const rarity = pod.heroData?.rarity || 'Common';
    const cost = TIER_PRICING[rarity] || 1;
    
    triggerModal({
      type: 'confirm',
      title: t('mining.rechargeSlot'),
      message: `${t('mining.rechargeConfirm')} ${cost} TON?`,
      confirmText: 'RECHARGE',
      onConfirm: () => {
        rechargeSlot(pod.id);
      }
    });
  };

  const handleRemove = (podId) => {
    removeMech(podId);
  };

  const getAvailableMechs = () => {
    // Global lock: collect all assigned hero IDs across all zones
    const assignedIds = new Set(
      zones.flatMap(z => z.pods)
        .filter(p => p.heroInstanceId || p.heroData?.instanceId)
        .map(p => p.heroInstanceId || p.heroData?.instanceId)
    );
    
    // Zone rarity restriction
    const requiredRarity = TIER_TO_RARITY[currentBoss.tier] || 'Common';

    return userHeroes.filter(h => !assignedIds.has(h.instanceId) && h.rarity === requiredRarity);
  };

  const availableMechs = getAvailableMechs();

  const handleAssignSelect = (heroInstanceId) => {
    miningData.assignMech(showAssignModal, heroInstanceId);
    setShowAssignModal(null);
  };

  // Helper: resolve hero display data from heroData (server) or userHeroes (client)
  const resolveHero = (pod) => {
    if (pod.heroData) {
      return pod.heroData; // Server embedded data
    }
    if (pod.heroInstanceId) {
      return userHeroes.find(h => h.instanceId === pod.heroInstanceId) || null;
    }
    return null;
  };

  return (
    <div className="flex flex-col flex-1 relative px-1 py-4">
      <div className="section-divider mb-4">
        <span className="text-[8px] text-[#00ffcc] font-black tracking-[0.2em]">{t('mining.title')}</span>
      </div>

        {/* Top Section: PENDING YIELD */}
        <div className="bg-black/60 border-2 border-[#00ffcc]/30 p-4 mb-4 shadow-[0_0_15px_rgba(0,255,204,0.1)] flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#00ffcc] font-bold tracking-widest uppercase mb-1">
              {t('mining.pending')}
            </div>
            <div className="text-2xl font-mono text-white tracking-widest font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
              {formattedYield} <span className="text-sm text-[#00ffcc]">TON</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button 
              disabled={globalTotal <= 0}
              onClick={handleClaim}
              id="mining-claim-btn"
              className={`px-6 py-3 font-black tracking-[0.2em] transition-all active:scale-95 border-b-4 border-r-4 ${
                globalTotal > 0
                  ? 'bg-[#00ffcc] hover:bg-[#33ffaa] text-black border-[#009977] shadow-[0_0_15px_rgba(0,255,204,0.4)]' 
                  : 'bg-gray-800 text-gray-500 border-gray-900 cursor-not-allowed opacity-60'
              }`}
            >
              {t('mining.claim')}
            </button>
            {globalTotal > 0 && (
              <div className="text-[7px] text-[#00ffcc]/60 font-bold tracking-widest">
                TOTAL: {globalTotal.toFixed(6)} TON
              </div>
            )}
          </div>
        </div>

        {/* Require Rarity Info */}
        <div className="bg-[#2c3e50]/40 border-l-4 border-[#3498db] p-2 mb-4 text-[9px] text-[#bdc3c7] font-bold tracking-wider">
           ℹ️ Zone Restriction: Only <strong className="text-white" style={{ color: currentBoss.color }}>{TIER_TO_RARITY[currentBoss.tier]}</strong> units allowed. Max {activeZone.pods.length} slots.
        </div>

        {/* Server sync indicator */}
        {!miningState.serverSynced && (
          <div className="bg-yellow-900/30 border border-yellow-600/50 p-2 mb-4 text-[8px] text-yellow-400 font-bold tracking-wider text-center animate-pulse">
            ⏳ Connecting to server...
          </div>
        )}

        {/* Middle Section: Containment Pods Grid */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          {activeZone.pods.map((pod, i) => {
            const hero = resolveHero(pod);
            const isWorking = pod.unlocked && hero;
            const isEmpty = pod.unlocked && !hero;
            
            return (
              <div 
                key={pod.id}
                className={`relative flex items-center p-3 border-2 transition-all overflow-hidden ${
                  pod.unlocked 
                    ? 'border-[#00ffcc]/40 bg-[#0f1a20]/80' 
                    : 'border-gray-800 bg-black/80 grayscale'
                }`}
              >
                {/* Pod Number */}
                <div className="absolute top-1 left-2 text-[8px] text-gray-500 font-bold">SLOT {i + 1}</div>
                
                {/* Lock Status overlay style */}
                {isWorking && hero ? (
                  <>
                    {pod.battery === 0 ? (
                      /* Offline Mech Mode */
                      <>
                        <div className="w-16 h-16 bg-black/80 border border-red-500/30 flex-shrink-0 flex items-center justify-center relative grayscale">
                          <div className="absolute inset-0 bg-red-900/10 z-10"></div>
                          <div className="w-12 h-12 opacity-50">
                            <Sprite char={hero} />
                          </div>
                          <div className="absolute -top-1 -right-1 bg-red-600 text-[6px] text-white px-1 font-black rounded z-20 animate-pulse uppercase">OFFLINE</div>
                        </div>

                        <div className="ml-4 flex-1">
                          <div className="text-[10px] text-gray-400 font-bold mb-1 italic">POWER DEPLETED</div>
                          <div className="flex gap-2">
                             <button 
                              onClick={() => handleRechargeSlot(pod)}
                              className="flex-1 bg-[#f39c12] hover:bg-[#e67e22] text-black text-[9px] font-black py-2 pixel-border-sm transition-all flex items-center justify-center gap-1 shadow-[0_3px_0_#d35400] active:shadow-none active:translate-y-[2px]"
                            >
                              ⚡ RECHARGE ({TIER_PRICING[hero.rarity] || 1} TON)
                            </button>
                            <button 
                              onClick={() => handleRemove(pod.id)}
                              className="bg-gray-800 hover:bg-black text-white text-[9px] font-bold px-3 py-2 border border-white/10 transition-all flex items-center justify-center gap-1"
                            >
                              🗑️ {t('mining.remove')}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Working Mech Mode */
                      <>
                        <div className="w-16 h-16 bg-black/60 border border-[#00ffcc]/30 flex-shrink-0 flex items-center justify-center relative shadow-inner">
                          <div className="w-12 h-12 transform scale-110 drop-shadow-[0_0_5px_rgba(0,255,204,0.5)]">
                            <Sprite char={hero} />
                          </div>
                        </div>
                        
                        <div className="ml-4 flex-1">
                          <div className="flex justify-between items-end mb-0.5">
                            <div className="text-[10px] text-white font-bold truncate">{hero.name}</div>
                            {(() => {
                              let cooldownStr = null;
                              if (pod.assignedAt) {
                                const oneHourMs = 60 * 60 * 1000;
                                const timeElapsed = Date.now() - pod.assignedAt;
                                if (timeElapsed < oneHourMs) {
                                  const timeLeftMs = oneHourMs - timeElapsed;
                                  const min = Math.floor(timeLeftMs / 60000);
                                  const sec = Math.floor((timeLeftMs % 60000) / 1000);
                                  cooldownStr = `🔒 ${min}m ${sec}s`;
                                }
                              }
                              
                              if (cooldownStr) {
                                return (
                                  <button 
                                    disabled
                                    className="text-[8px] text-gray-500 cursor-not-allowed opacity-80 shrink-0 ml-2"
                                  >
                                    {cooldownStr}
                                  </button>
                                );
                              }

                              return (
                                <button 
                                  onClick={() => handleRemove(pod.id)}
                                  className="text-[8px] text-red-400 hover:text-red-300 underline shrink-0 ml-2"
                                >
                                  {t('mining.remove')}
                                </button>
                              );
                            })()}
                          </div>
                          
                          <div className="text-[9px] text-[#e74c3c] font-bold mb-0.5">
                            ⚔️ ATK: {hero.atk || 0} <span className="text-gray-400 font-normal">(Grade {hero.grade || 'B'})</span>
                          </div>
                          <div className="text-[9px] text-[#00ffcc] font-mono font-bold tracking-widest drop-shadow-[0_0_2px_rgba(0,255,204,0.5)] mb-1.5">
                            💰 +{((hero.atk || 0) * BASE_RATE_PER_ATK).toFixed(3)} {t('mining.perDay')}
                          </div>
                          
                          {/* Battery Bar */}
                          <div className="w-full bg-gray-900 h-2 border border-blue-900 relative">
                            <div 
                              className="h-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)] transition-all"
                              style={{ width: `${Math.max(0, pod.battery || 0)}%`, backgroundColor: (pod.battery || 0) < 20 ? '#ef4444' : '#3b82f6' }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center text-[6px] text-white font-bold mix-blend-difference">
                              {(pod.battery || 0).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : isEmpty ? (
                  <>
                    <button 
                      onClick={() => setShowAssignModal(pod.id)}
                      className="w-full h-16 border-2 border-dashed border-[#00ffcc]/30 hover:border-[#00ffcc] bg-black/40 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#00ffcc]/20 flex items-center justify-center text-[#00ffcc] text-lg leading-none pb-0.5 animate-pulse">
                        +
                      </div>
                      <span className="text-[#00ffcc] text-[10px] tracking-widest">{t('mining.assign')}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Locked */}
                    <div className="w-full h-16 flex flex-col items-center justify-center bg-gray-900/50">
                      <button 
                        onClick={() => handleUnlock(pod)}
                        className="bg-red-900/50 hover:bg-red-800 text-white px-4 py-1.5 text-[9px] font-bold tracking-widest pixel-border-sm flex items-center gap-2"
                      >
                        <span>🔒</span> {t('mining.unlockPod')} - Cost: {pod.unlockCost} TON
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

      {/* Assign Modal */}
      {showAssignModal && (
         <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[#0f111a] w-full max-w-xs border-[3px] border-[#00ffcc]/50 pixel-border flex flex-col max-h-[80vh]">
             <div className="px-4 py-3 bg-[#00ffcc]/20 border-b border-[#00ffcc]/50 flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-[#00ffcc] text-[11px] font-bold tracking-widest">{t('mining.selectMech')}</h3>
                  <div className="text-[8px] text-gray-400 mt-1 uppercase">REQUIREMENT: <strong style={{ color: currentBoss.color }}>{TIER_TO_RARITY[currentBoss.tier]}</strong> ONLY</div>
               </div>
               <button onClick={() => setShowAssignModal(null)} className="text-[#00ffcc] text-lg ml-2 hover:text-white pb-1">×</button>
             </div>
             
             <div className="p-4 flex-1 overflow-y-auto w-full no-scrollbar">
               {availableMechs.length === 0 ? (
                 <div className="text-center flex flex-col items-center py-6">
                    <span className="text-2xl mb-2 opacity-50">🤖</span>
                    <div className="text-gray-500 text-[9px] font-bold tracking-wider leading-relaxed">
                      NO IDLE UNITS FOUND<br/><span className="text-[7px]">MUST BE <span style={{ color: currentBoss.color }}>{TIER_TO_RARITY[currentBoss.tier]}</span> RARITY</span>
                    </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-2 gap-3 w-full pb-4">
                   {availableMechs.map(hero => (
                     <div 
                       key={hero.instanceId} 
                       onClick={() => handleAssignSelect(hero.instanceId)}
                       className="bg-black/60 border border-gray-700 hover:border-[#00ffcc] p-2 flex flex-col items-center justify-center cursor-pointer transition-colors"
                     >
                       <div className="w-12 h-12 mb-1 drop-shadow-md">
                         <Sprite char={hero} />
                       </div>
                       <div className="text-[8px] text-white text-center w-full truncate font-bold">{hero.name}</div>
                       <div className="text-[7px] text-[#e74c3c] font-black tracking-tighter mt-0.5 leading-none uppercase text-center w-full">
                         ⚔️ ATK: {hero.atk}
                       </div>
                       <div className="text-[7px] text-[#00ffcc] font-mono mt-0.5 border-t border-gray-800 pt-1 w-full text-center">
                         +{(hero.atk * BASE_RATE_PER_ATK).toFixed(3)}/d
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         </div>
      )}
    </div>
  );
}

export default IdleMining;
