import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('pixel_war_lang');
    return saved === 'en' ? 'en' : 'th'; // Default to Thai
  });

  useEffect(() => {
    localStorage.setItem('pixel_war_lang', lang);
  }, [lang]);

  const t = useCallback((key, params) => {
    const entry = translations[key];
    if (!entry) return key; // Fallback: show raw key
    let text = entry[lang] || entry['en'] || key;
    // Replace {param} placeholders
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return text;
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang(prev => prev === 'th' ? 'en' : 'th');
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within LanguageProvider');
  return ctx;
}
