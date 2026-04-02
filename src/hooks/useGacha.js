import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { DROP_RATES } from '../data/tokenomics';

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function useGacha() {
  const [srPity, setSrPity] = useState(0);
  const [epicPity, setEpicPity] = useState(0);
  const [legendaryPity, setLegendaryPity] = useState(0);
  const [totalPulls, setTotalPulls] = useState(0);

  const pullMultiple = (count) => {
    let currentSrPity = srPity;
    let currentEpicPity = epicPity;
    let currentLegendaryPity = legendaryPity;
    let results = [];
    let batchHasSr = false;
    let batchHasEpic = false;

    for (let i = 0; i < count; i++) {
       currentSrPity++;
       currentEpicPity++;
       currentLegendaryPity++;
      
      let rollRarity = null;

      // 1. Check Global Pity systems (Legendary > Epic > SR)
      if (currentLegendaryPity >= 50) {
        rollRarity = 'Legendary';
      } else if (currentEpicPity >= 10) {
        rollRarity = 'Epic';
      } else if (currentSrPity >= 5) {
        rollRarity = 'SR';
      } else {
        // 2. Normal weighted roll — uses tokenomics drop rates
        // Common: 50%, Rare: 30%, SR: 15%, Epic: 4%, Legendary: 1%
        const roll = Math.floor(Math.random() * 10000) + 1;
        
        const commonCeil = DROP_RATES.Common;                          // 5000
        const rareCeil   = commonCeil + DROP_RATES.Rare;               // 8000
        const srCeil     = rareCeil + DROP_RATES.SR;                   // 9500
        const epicCeil   = srCeil + DROP_RATES.Epic;                   // 9900

        if (roll <= commonCeil) rollRarity = 'Common';
        else if (roll <= rareCeil) rollRarity = 'Rare';
        else if (roll <= srCeil) rollRarity = 'SR';
        else if (roll <= epicCeil) rollRarity = 'Epic';
        else rollRarity = 'Legendary';
      }

      // 3. Batch Guarantee Overrides
      // For x5: Ensure at least one SR+ in the batch (Force on last slot if none appeared)
      if (count === 5 && i === 4 && !batchHasSr && rollRarity !== 'Legendary' && rollRarity !== 'Epic') {
        rollRarity = 'SR';
      }
      // For x10: Ensure at least one Epic+ in the batch (Force on last slot if none appeared)
      if (count === 10 && i === 9 && !batchHasEpic && rollRarity !== 'Legendary') {
        rollRarity = 'Epic';
      }

      // 4. Update batch trackers and reset Pity Counters
      if (rollRarity === 'Legendary') {
        batchHasEpic = true;
        batchHasSr = true;
        currentLegendaryPity = 0;
        currentEpicPity = 0;
        currentSrPity = 0;
      } else if (rollRarity === 'Epic') {
        batchHasEpic = true;
        batchHasSr = true;
        currentEpicPity = 0;
        currentSrPity = 0;
      } else if (rollRarity === 'SR') {
        batchHasSr = true;
        currentSrPity = 0;
      }

      // 5. Select base character and generate randomized stats
      const pool = CHARACTERS.filter(c => c.rarity === rollRarity);
      const baseRobot = pickRandom(pool);
      
      // Stat Multipliers: 0.90 - 1.15
      const hpMult = (Math.floor(Math.random() * (115 - 90 + 1)) + 90) / 100;
      const atkMult = (Math.floor(Math.random() * (115 - 90 + 1)) + 90) / 100;
      const defMult = (Math.floor(Math.random() * (115 - 90 + 1)) + 90) / 100;
      const spdMult = (Math.floor(Math.random() * (115 - 90 + 1)) + 90) / 100;

      const finalHp = Math.round(baseRobot.hp * hpMult);
      const finalAtk = Math.round(baseRobot.atk * atkMult);
      const finalDef = Math.round(baseRobot.def * defMult);
      const finalSpd = Math.round(baseRobot.spd * spdMult);

      // Grade calculation based on Average of all 4 multipliers
      const avgMult = (hpMult + atkMult + defMult + spdMult) / 4;
      let grade = 'B';
      if (avgMult >= 1.10) grade = 'S';
      else if (avgMult > 1.00) grade = 'A';
      else if (avgMult < 0.95) grade = 'C';

      results.push({
        ...baseRobot,
        hp: finalHp,
        maxHp: finalHp,
        atk: finalAtk,
        def: finalDef,
        spd: finalSpd,
        grade: grade,
        hpMult,
        atkMult,
        defMult,
        spdMult
      });
    }

    // Save states
    setSrPity(currentSrPity);
    setEpicPity(currentEpicPity);
    setLegendaryPity(currentLegendaryPity);
    setTotalPulls(totalPulls + count);

    return results;
  };

  return { pullMultiple, epicPity, legendaryPity, srPity, totalPulls };
}
