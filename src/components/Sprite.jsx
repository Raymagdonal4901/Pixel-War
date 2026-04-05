import React from 'react';

const Sprite = ({ char, className = "" }) => {
  if (!char) return <span>🤖</span>;
  if (char.imagePath) {
    // Standard Vite public path
    const src = char.imagePath.startsWith('/') ? char.imagePath : `/${char.imagePath}`;
    return (
      <img 
        src={src} 
        alt={char.name} 
        className={`${className} w-full h-full object-contain image-pixelated`}
        style={{ minWidth: '20px', minHeight: '20px' }}
      />
    );
  }
  const { sprite } = char;
  if (!sprite) return <span>🤖</span>;
  const cols = 8;
  const rows = 8; 
  return (
    <div 
      className={className}
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: `url('/${sprite.sheet}')`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${(sprite.col / (cols - 1)) * 100}% ${(sprite.row / (rows - 1)) * 100}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated'
      }}
    />
  );
};

export default Sprite;
