import { useState } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useT } from '../i18n/LanguageContext';

const DEV_WALLET = "UQBc7XwYlXbqVYO76GOizi3Ji97aFHj98jKfbKUkUWKUgP2p";

export default function RepairPaymentButton({ repairCost, userId, onSuccess, disabled, triggerModal }) {
  const [tonConnectUI] = useTonConnectUI();
  const [isVerifying, setIsVerifying] = useState(false);
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
      triggerModal({
        type: 'confirm',
        title: t('modal.warning'),
        message: "Please connect your TON wallet first!",
        confirmText: "CONNECT",
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
        triggerModal({
          type: 'alert',
          title: t('modal.success'),
          message: "Payment Confirmed! Your squad has been fully repaired.",
          onConfirm: () => {
            if (onSuccess) onSuccess();
          }
        });
      } else {
        triggerModal({
          type: 'alert',
          title: t('modal.error'),
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
  );
}

// Minimal placeholder
function generateTextPayload() {
  return "te6ccsEBAQEABgAACA=="; 
}
