import React, { createContext, useContext, useEffect, useState } from 'react'

// Temas disponíveis do aplicativo
export type AppTheme = 'classic' | 'ios' | 'amoled' | 'emerald'

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
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME)
    if (saved === 'ios' || saved === 'amoled' || saved === 'emerald' || saved === 'classic') {
      return saved
    }
    return 'classic'
  })

  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT)
    return saved === 'small' || saved === 'large' ? saved : 'medium'
  })

  // Aplica o tema em toda a árvore (o CSS em main.css reage às classes .theme-ios, .theme-amoled, .theme-emerald)
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-ios', 'theme-amoled', 'theme-emerald', 'theme-classic')
    root.classList.add(`theme-${theme}`)
    localStorage.setItem(STORAGE_KEYS.THEME, theme)
  }, [theme])

  // Escala global de fonte (tamanhos em rem acompanham o html)
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontScale]
    localStorage.setItem(STORAGE_KEYS.FONT, fontScale)
  }, [fontScale])

  const setTheme = (next: AppTheme) => {
    setThemeState(next)
    try {
      const savedLogs = localStorage.getItem('wa_clone_event_logs')
      const logs = savedLogs ? JSON.parse(savedLogs) : []
      const now = new Date()
      const timestamp = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      const themeLabels: Record<AppTheme, string> = {
        classic: 'Clássico',
        ios: 'iOS Claro',
        amoled: 'AMOLED',
        emerald: 'Esmeralda',
      }
      const newLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp,
        action: 'theme_changed',
        description: `Tema do aplicativo alterado para "${themeLabels[next]}".`,
        level: 'info',
      }
      localStorage.setItem('wa_clone_event_logs', JSON.stringify([newLog, ...logs.slice(0, 199)]))
    } catch {
      // ignora
    }
  }

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
