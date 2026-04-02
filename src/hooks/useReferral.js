import { useState, useCallback, useEffect } from 'react';

/**
 * useReferral Hook
 * Manages the user's referral network statistics and claiming logic.
 */
export const useReferral = (balance, setBalance) => {
  // State for network data
  const [referralData, setReferralData] = useState(() => {
    const saved = localStorage.getItem('pixel_war_referral');
    if (saved) return JSON.parse(saved);
    
    // Default initial mock data for first-time users
    return {
      tier1: { count: 12, earned: 85.5 },
      tier2: { count: 48, earned: 42.0 },
      tier3: { count: 156, earned: 18.0 },
      unclaimed: 1.250,
      totalEarned: 146.75,
      refLink: 'pixelwar.io/ref/User123'
    };
  });

  // Save to local storage whenever data changes
  useEffect(() => {
    localStorage.setItem('pixel_war_referral', JSON.stringify(referralData));
  }, [referralData]);

  /**
   * Performs the claim action.
   * Adds the unclaimed amount to the user's balance and resets the local unclaimed counter.
   */
  const claimRewards = useCallback(() => {
    if (referralData.unclaimed <= 0) return false;

    const amountToClaim = referralData.unclaimed;
    
    // Update global balance
    setBalance(prev => prev + amountToClaim);
    
    // Reset unclaimed rewards locally
    setReferralData(prev => ({
      ...prev,
      unclaimed: 0,
      totalEarned: prev.totalEarned + amountToClaim
    }));

    return amountToClaim;
  }, [referralData.unclaimed, setBalance]);

  /**
   * Simulated function to refresh data from a backend/smart contract.
   */
  const refreshStats = useCallback(async () => {
    // This is where you would perform a fetch request to your server.
    // For now, we'll just simulate a small delay.
    console.log("Refining referral stats...");
    await new Promise(res => setTimeout(res, 500));
    
    // Potentially update with new counts/earnings if your backend logic says so.
  }, []);

  return {
    referralData,
    claimRewards,
    refreshStats
  };
};
