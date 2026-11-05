import React, { createContext, useContext, useEffect, useState } from 'react'

// Temas disponíveis do aplicativo
export type AppTheme = 'classic' | 'ios'

// Escala de fonte escolhida nas configurações
export type FontScale = 'small' | 'medium' | 'large'

interface AppThemeContextType {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  fontScale: FontScale
  setFontScale: (scale: FontScale) => void
}

const STORAGE_KEYS = {
  THEME: 'wa_clone_theme',
  FONT: 'wa_clone_font_size',
}

const FONT_SIZES: Record<FontScale, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() =>
    localStorage.getItem(STORAGE_KEYS.THEME) === 'ios' ? 'ios' : 'classic',
  )

  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT)
    return saved === 'small' || saved === 'large' ? saved : 'medium'
  })

  // Aplica o tema em toda a árvore (o CSS em main.css reage à classe .theme-ios)
  useEffect(() => {
    document.documentElement.classList.toggle('theme-ios', theme === 'ios')
    localStorage.setItem(STORAGE_KEYS.THEME, theme)
  }, [theme])

  // Escala global de fonte (tamanhos em rem acompanham o html)
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontScale]
    localStorage.setItem(STORAGE_KEYS.FONT, fontScale)
  }, [fontScale])

  const setTheme = (next: AppTheme) => setThemeState(next)
  const setFontScale = (next: FontScale) => setFontScaleState(next)

  return (
    <AppThemeContext.Provider value={{ theme, setTheme, fontScale, setFontScale }}>
      {children}
    </AppThemeContext.Provider>
  )
}

export const useAppTheme = () => {
  const context = useContext(AppThemeContext)
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider')
  }
  return context
}
