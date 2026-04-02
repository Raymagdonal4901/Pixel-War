import { useState } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useT } from '../i18n/LanguageContext';

const DEV_WALLET = "UQBc7XwYlXbqVYO76GOizi3Ji97aFHj98jKfbKUkUWKUgP2p";

export default function RepairPaymentButton({ repairCost, userId, onSuccess, disabled }) {
  const [tonConnectUI] = useTonConnectUI();
  const [isVerifying, setIsVerifying] = useState(false);
  const [alertData, setAlertData] = useState(null);
  const { t } = useT();

  // Helper check function ported directly to React Context
  const checkTransactionInterval = async (expectedAmountInNano, startTime) => {
    let isPaid = false;
    let attempts = 0;

    // Loop every 5 seconds (up to 12 times = 60s)
    while (!isPaid && attempts < 12) {
      attempts++;
      console.log(`[TonCenter] Checking transaction... Attempt ${attempts}/12`);
      
      try {
        const response = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${DEV_WALLET}&limit=10`);
        const data = await response.json();

        if (data.ok && data.result) {
          for (let tx of data.result) {
            const msg = tx.in_msg;
            
            // We compare message values and times to be safe since we don't have a true BOC memo
            // 1. Transaction must be incoming (msg.value exists and is > 0)
            // 2. Value must meet or exceed our expected amount
            // 3. The transaction unix timestamp must be equal to or newer than when we triggered the check
            if (msg && Number(msg.value) >= Number(expectedAmountInNano) && tx.utime >= startTime) {
              isPaid = true;
              console.log("✅ Payment Verified on Blockchain!");
              return true; 
            }
          }
        }
      } catch (err) {
        console.error("TonCenter fetch error:", err);
      }
      
      // Wait 5 seconds before the next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return false; // Timeout reached, no matching transaction found
  };

  const handlePayment = async () => {
    // Force wallet connection before proceeding if not connected!
    if (!tonConnectUI.connected) {
      setAlertData({
        type: 'error',
        message: "Please connect your TON wallet first!",
        onConfirm: async () => {
          await tonConnectUI.connectWallet();
        }
      });
      return;
    }

    const uniqueMemo = `repair_${userId}_${Date.now()}`;
    const amountInNano = Math.floor(repairCost * 1000000000).toString();

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 360,
      messages: [
        {
          address: DEV_WALLET,
          amount: amountInNano,
          payload: generateTextPayload(uniqueMemo) 
        }
      ]
    };

    try {
      // 1. Send the transaction to the user's wallet
      await tonConnectUI.sendTransaction(transaction);
      
      // 2. Wallet confirmed sending. Start the verification spinner and poller
      setIsVerifying(true);
      const submitTimeSeconds = Math.floor(Date.now() / 1000); 
      
      // 3. Polling the blockchain API 
      const verified = await checkTransactionInterval(amountInNano, submitTimeSeconds);
      
      if (verified) {
        // Success! Repair the heroes
        setAlertData({
          type: 'success',
          message: "Payment Confirmed! Your squad has been fully repaired.",
          onConfirm: () => {
            if (onSuccess) onSuccess();
          }
        });
      } else {
        setAlertData({
          type: 'error',
          message: "Transaction took too long or could not be found. Please try again or wait a few minutes."
        });
      }
    } catch (e) {
      console.error("Wallet execution cancelled or failed.", e);
    } finally {
      setIsVerifying(false); // Stop loading regardless of outcome
    }
  };

  return (
    <>
      <div className={`w-full p-1 ${isVerifying ? 'bg-orange-900/40' : !disabled ? 'bg-[#1e293b]' : 'bg-gray-800'} mb-1`}>
        <button 
          onClick={handlePayment}
          disabled={disabled || isVerifying}
          className={`w-full py-4 transition-all flex justify-center items-center flex-col relative overflow-hidden focus:outline-none ${
            isVerifying ? 'bg-orange-600 hover:bg-orange-500 text-white animate-pulse' :
            !disabled ? 'bg-[#2563eb] hover:bg-[#3b82f6] text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]' : 
            'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isVerifying ? (
            <>
              <span className="flex items-center gap-2 font-black text-xs uppercase tracking-widest">
                <span className="animate-spin text-base">⏳</span>
                VERIFYING ON-CHAIN...
              </span>
              <span className="text-[8px] text-orange-200 font-mono mt-1 opacity-80">Waiting for block confirmation</span>
            </>
          ) : (
            <>
              <span className="font-black text-[13px] uppercase tracking-wider drop-shadow-md">{t('roster.confirmRepair', { defaultValue: 'CONFIRM REPAIR' })}</span>
              {!disabled && (
                <span className="text-[#a5c0ff] text-[9px] font-mono mt-0.5 tracking-wider drop-shadow-sm font-bold">Pay {repairCost.toFixed(4)} TON</span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Alert Modal Pop-up */}
      {alertData && (
        <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-[280px] bg-[#1a1c23] border-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative flex flex-col items-center overflow-hidden ${alertData.type === 'error' ? 'border-[#ff3344] shadow-[#ff3344]/30' : 'border-[#2ecc71] shadow-[#2ecc71]/30'}`}>
            
            {/* Header */}
            <div className={`w-full p-2.5 flex items-center gap-2 ${alertData.type === 'error' ? 'bg-[#ff3344]' : 'bg-[#2ecc71]'}`}>
              <span className="text-white text-sm animate-pulse">
                {alertData.type === 'error' ? '⚠️' : '✅'}
              </span>
              <h3 className="text-white text-[10px] font-black tracking-widest uppercase truncate drop-shadow-md">
                {alertData.type === 'error' ? 'SYSTEM ALERT' : 'TRANSACTION SUCCESS'}
              </h3>
            </div>
            
            {/* Body */}
            <div className="p-6 w-full flex flex-col items-center gap-5 text-center bg-[#1c1f28]">
              <p className="text-[#e2e8f0] text-[11px] leading-relaxed font-bold font-sans">
                {alertData.message}
              </p>
              
              <button 
                onClick={() => {
                  if (alertData.onConfirm) alertData.onConfirm();
                  setAlertData(null);
                }}
                className={`w-full py-3.5 text-[10px] uppercase font-black tracking-widest transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  alertData.type === 'error' 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]'
                    : 'bg-[#2ecc71] hover:bg-[#27ae60] text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]'
                }`}
              >
                {t('arcade.continue', { defaultValue: 'PROCEED' })}
              </button>
            </div>

            {/* Decorative scanline */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-px animate-scanline"></div>
          </div>
        </div>
      )}
    </>
  );
}

// Minimal placeholder
function generateTextPayload() {
  return "te6ccsEBAQEABgAACA=="; 
}
