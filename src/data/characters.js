export const RARITY_COLORS = {
  Common: "var(--color-common)", 
  Rare: "var(--color-rare)",
  SR: "var(--color-sr)",
  Epic: "var(--color-epic)",     
  Legendary: "#f1c40f"           
};

// Procedurally generate characters from individual images in public/Robot
const generateCharacters = () => {
  const rarities = [
    { key: 'Common', prefix: 'common', count: 99, hp: 2000, atk: 200, def: 5, spd: 10, imageColor: '#7f8c8d' },
    { key: 'Rare', prefix: 'rare', count: 79, hp: 6000, atk: 600, def: 15, spd: 30, imageColor: '#3498db' },
    { key: 'SR', prefix: 'super_rare', count: 60, hp: 10000, atk: 1000, def: 30, spd: 55, imageColor: '#2ecc71' },
    { key: 'Epic', prefix: 'epic', count: 40, hp: 14000, atk: 1400, def: 50, spd: 85, imageColor: '#9b59b6' },
    { key: 'Legendary', prefix: 'legendary', count: 20, hp: 20000, atk: 2000, def: 120, spd: 180, imageColor: '#2c003e' }
  ];

  let list = [];
  
  rarities.forEach(r => {
    for (let i = 1; i <= r.count; i++) {
      list.push({
        id: `robot_${r.prefix}_${i}`,
        name: `${r.key === 'SR' ? 'S.Rare' : r.key} Robot #${i}`,
        rarity: r.key,
        type: 'Robot',
        hp: r.hp, 
        maxHp: r.hp, 
        atk: r.atk,
        def: r.def,
        spd: r.spd,
        color: RARITY_COLORS[r.key],
        imageColor: r.imageColor,
        imagePath: `/Robot/${r.prefix}_${i}.png`,
        attackType: i % 2 === 0 ? 'melee' : 'ranged'
      });
    }
  });

  return list;
};

export const CHARACTERS = generateCharacters();

export const getPlayerSquad = () => {
  return [
    CHARACTERS.find(c => c.rarity === "Legendary") || CHARACTERS[0],
    CHARACTERS.find(c => c.rarity === "Epic") || CHARACTERS[1],
    CHARACTERS.find(c => c.rarity === "SR") || CHARACTERS[2],
    CHARACTERS.find(c => c.rarity === "Rare") || CHARACTERS[3]
  ];
};
