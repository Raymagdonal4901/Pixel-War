import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { Address } from '@ton/core';

class TonWalletService {
  constructor() {
    this.client = null;
    this.wallet = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const mnemonic = process.env.TREASURY_MNEMONIC;
      const apiKey = process.env.TONCENTER_API_KEY;
      const apiUrl = process.env.TONCENTER_API_URL || 'https://toncenter.com/api/v2/jsonRPC';
      const network = process.env.TON_NETWORK || 'mainnet';

      if (!mnemonic) {
        throw new Error('TREASURY_MNEMONIC not found in environment variables');
      }

      if (!apiKey) {
        console.warn('[TON Wallet] No TONCENTER_API_KEY found. Using public API (rate limited)');
      }

      const mnemonicArray = mnemonic.trim().split(' ');
      if (mnemonicArray.length !== 24) {
        throw new Error(`Invalid mnemonic: expected 24 words, got ${mnemonicArray.length}`);
      }

      const keyPair = await mnemonicToPrivateKey(mnemonicArray);

      const endpoint = apiKey 
        ? `${apiUrl}?api_key=${apiKey}`
        : apiUrl;

      this.client = new TonClient({
        endpoint: endpoint,
        apiKey: apiKey
      });

      this.wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
      });

      const contract = this.client.open(this.wallet);
      this.walletContract = contract;
      this.keyPair = keyPair;

      const balance = await contract.getBalance();
      const address = this.wallet.address.toString();

      console.log(`[TON Wallet] ✅ Initialized successfully`);
      console.log(`[TON Wallet] Address: ${address}`);
      console.log(`[TON Wallet] Balance: ${(Number(balance) / 1e9).toFixed(4)} TON`);
      console.log(`[TON Wallet] Network: ${network}`);

      this.isInitialized = true;
    } catch (error) {
      console.error('[TON Wallet] ❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async sendTon(destinationAddress, amount, comment = '') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`[TON Wallet] Preparing to send ${amount} TON to ${destinationAddress}`);

      const destination = Address.parse(destinationAddress);
      const amountNano = BigInt(Math.floor(amount * 1e9));

      const seqno = await this.walletContract.getSeqno();
      console.log(`[TON Wallet] Current seqno: ${seqno}`);

      const transfer = this.walletContract.createTransfer({
        seqno,
        secretKey: this.keyPair.secretKey,
        messages: [
          internal({
            to: destination,
            value: amountNano,
            body: comment,
            bounce: false
          })
        ]
      });

      await this.walletContract.send(transfer);

      console.log(`[TON Wallet] ✅ Transaction sent successfully`);
      console.log(`[TON Wallet] Waiting for confirmation...`);

      let currentSeqno = seqno;
      const maxRetries = 30;
      let retries = 0;

      while (currentSeqno === seqno && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentSeqno = await this.walletContract.getSeqno();
        retries++;
        
        if (retries % 5 === 0) {
          console.log(`[TON Wallet] Still waiting... (${retries}/${maxRetries})`);
        }
      }

      if (currentSeqno === seqno) {
        throw new Error('Transaction timeout - seqno did not change');
      }

      console.log(`[TON Wallet] ✅ Transaction confirmed (new seqno: ${currentSeqno})`);

      const txHash = `${Date.now()}_${seqno}`;
      
      return {
        success: true,
        txHash: txHash,
        seqno: currentSeqno,
        amount: amount,
        destination: destinationAddress
      };

    } catch (error) {
      console.error('[TON Wallet] ❌ Send failed:', error.message);
      throw new Error(`Failed to send TON: ${error.message}`);
    }
  }

  async getBalance() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const balance = await this.walletContract.getBalance();
      return Number(balance) / 1e9;
    } catch (error) {
      console.error('[TON Wallet] Failed to get balance:', error.message);
      throw error;
    }
  }

  getAddress() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet.address.toString();
  }
}

const tonWalletService = new TonWalletService();

export default tonWalletService;
