import Player from './models/Player.js';

// Configuration
const SCRAP_REWARD_LOW = 5;
const SCRAP_REWARD_HIGH = 10;
const CRAFT_COST_SCRAP = 50;

/**
 * Get current Day ID (Reset at 00:00 UTC / 07:00 ICT)
 */
function getDayId() {
  const now = new Date();
  // Simplified day ID based on UTC days since epoch
  return Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
}

export async function processCheckIn(wallet) {
  try {
    const player = await Player.findOne({ wallet });
    if (!player) return { success: false, error: 'Player not found' };

    const todayId = getDayId();
    const lastId = player.lastCheckIn ? Math.floor(player.lastCheckIn.getTime() / (1000 * 60 * 60 * 24)) : -1;

    if (todayId === lastId) {
      return { success: false, error: 'Already checked in today' };
    }

    // Determine if streak continues
    let newStreak = 1;
    if (todayId === lastId + 1) {
      newStreak = (player.dailyStreak % 7) + 1;
    } else {
      // Missed a day or first time
      newStreak = 1;
    }

    // Assign Rewards
    let rewardType = 'scrap';
    let rewardAmount = 0;
    let rewardLabel = "";

    if (newStreak <= 3) {
      rewardAmount = SCRAP_REWARD_LOW;
      player.scrap = (player.scrap || 0) + rewardAmount;
      rewardLabel = `${rewardAmount} SCRAP`;
    } else if (newStreak <= 6) {
      rewardAmount = SCRAP_REWARD_HIGH;
      player.scrap = (player.scrap || 0) + rewardAmount;
      rewardLabel = `${rewardAmount} SCRAP`;
    } else if (newStreak === 7) {
      rewardType = 'box';
      rewardAmount = 1;
      player.mechTickets = (player.mechTickets || 0) + 1;
      rewardLabel = "COMMON MECH BOX";
    }

    player.dailyStreak = newStreak;
    player.lastCheckIn = new Date();
    await player.save();

    return { 
      success: true, 
      streak: newStreak, 
      rewardType, 
      rewardAmount, 
      rewardLabel,
      scrap: player.scrap,
      mechTickets: player.mechTickets
    };

  } catch (err) {
    console.error('❌ [MissionEngine] Check-in error:', err);
    return { success: false, error: err.message };
  }
}

export async function completeSocialTask(wallet, taskId) {
  try {
    const player = await Player.findOne({ wallet });
    if (!player) return { success: false, error: 'Player not found' };

    if (player.completedTasks.includes(taskId)) {
      return { success: false, error: 'Task already completed' };
    }

    let rewardLabel = "";
    let rewardType = "scrap";
    let rewardAmount = 0;

    // Define Rewards per Task
    if (taskId === 'tg_join') {
      rewardAmount = 5;
      player.scrap = (player.scrap || 0) + rewardAmount;
      rewardLabel = "5 SCRAP";
    } else if (taskId === 'x_follow') {
      rewardAmount = 20;
      player.scrap = (player.scrap || 0) + rewardAmount;
      rewardLabel = "20 SCRAP";
    } else if (taskId === 'invite_3') {
      rewardType = 'box';
      rewardAmount = 1;
      player.mechTickets = (player.mechTickets || 0) + 1;
      rewardLabel = "1 COMMON BOX";
    }

    player.completedTasks.push(taskId);
    await player.save();

    return { 
      success: true, 
      rewardType, 
      rewardAmount, 
      rewardLabel, 
      scrap: player.scrap,
      mechTickets: player.mechTickets,
      completedTasks: player.completedTasks
    };
  } catch (err) {
    console.error('❌ [MissionEngine] Task error:', err);
    return { success: false, error: err.message };
  }
}

export async function processCraft(wallet) {
  try {
    const player = await Player.findOne({ wallet });
    if (!player) return { success: false, error: 'Player not found' };

    if ((player.scrap || 0) < CRAFT_COST_SCRAP) {
      return { success: false, error: 'Not enough scrap' };
    }

    player.scrap -= CRAFT_COST_SCRAP;
    player.mechTickets = (player.mechTickets || 0) + 1;
    
    await player.save();
    return { success: true, scrap: player.scrap, mechTickets: player.mechTickets };
  } catch (err) {
    console.error('❌ [MissionEngine] Crafting error:', err);
    return { success: false, error: err.message };
  }
}

export async function getMissionStatus(wallet) {
    const player = await Player.findOne({ wallet });
    if (!player) return null;
    
    return {
        scrap: player.scrap || 0,
        streak: player.dailyStreak || 0,
        mechTickets: player.mechTickets || 0,
        completedTasks: player.completedTasks || [],
        canCheckIn: (getDayId() !== (player.lastCheckIn ? Math.floor(player.lastCheckIn.getTime() / (1000 * 60 * 60 * 24)) : -1))
    };
}
