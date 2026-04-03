/**
 * Telegram Notification Utility
 * Sends rich HTML formatted messages to the user via Telegram Bot API
 */

export const sendTelegramNotification = async (type, data) => {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const testChatId = import.meta.env.VITE_TELEGRAM_TEST_CHAT_ID;
  
  // Try to get chat_id from Telegram Mini App context
  let chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || testChatId;

  if (!botToken || !chatId) {
    console.warn('Telegram Notification Skip: Bot Token or Chat ID not found.');
    return;
  }

  let message = '';

  if (type === 'deposit') {
    message = `
<b>✅ Deposit Confirmed!</b>

💰 <b>+${data.amount.toFixed(4)} TON</b> has been added to your balance.
🎁 <b>Promo bonus: +${data.bonus.toFixed(4)} TON (20% extra!)</b>
💼 <b>Total credited: ${data.total.toFixed(4)} TON</b>
💼 <b>New balance: ${data.newBalance.toFixed(4)} TON</b>

Keep upgrading your mechs! 🏰
    `.trim();
  } else if (type === 'withdrawal') {
    message = `
<b>✅ Withdrawal Approved!</b>

💸 <b>${data.amount.toFixed(4)} TON</b> has been sent to your wallet.
🔗 <a href="https://tonscan.org/tx/${data.txId}">View Transaction</a>

Thank you for playing Pixel War! 🤖
    `.trim();
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: Math.random() > 0 ? JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      }) : null
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API Error:', result.description);
    }
    return result.ok;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
};
