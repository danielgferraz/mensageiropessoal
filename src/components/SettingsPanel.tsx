import React, { useState } from 'react'
import { ArrowLeft, Palette, Type, Sparkles, Smartphone, LayoutGrid, Check } from 'lucide-react'
import { useAppTheme, AppTheme, FontScale } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

interface SettingsPanelProps {
  onClose: () => void
}

// Seletor de tema estilo iOS (segmented control)
const THEME_OPTIONS: { id: AppTheme; label: string; description: string }[] = [
  {
    id: 'classic',
    label: 'Clássico',
    description: 'O visual escuro tradicional do WhatsApp Web.',
  },
  {
    id: 'ios',
    label: 'iOS',
    description: 'Frosted glass, cantos suaves e cores claras do sistema da Apple.',
  },
]

const FONT_OPTIONS: { id: FontScale; label: string }[] = [
  { id: 'small', label: 'Pequena' },
  { id: 'medium', label: 'Média' },
  { id: 'large', label: 'Grande' },
]

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const { theme, setTheme, fontScale, setFontScale } = useAppTheme()
  const [appliedFlash, setAppliedFlash] = useState<AppTheme | null>(null)

  const handleThemeChange = (next: AppTheme) => {
    setTheme(next)
    setAppliedFlash(next)
    setTimeout(() => setAppliedFlash(null), 1800)
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] border-r border-[#222d34] text-slate-100 z-30 shrink-0">
      {/* Cabeçalho */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center space-x-3 border-b border-[#2a3942] shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-[#374248]/50 -ml-2 transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold">Configurações</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* TEMA DO APLICATIVO */}
        <section>
          <div className="flex items-center space-x-2 mb-1">
            <Palette className="w-4 h-4 text-[#00a884]" />
            <h3 className="text-sm font-semibold text-slate-100">Tema do aplicativo</h3>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            A aparência é aplicada em todo o app (conversas, painéis e modais) e fica salva neste
            navegador.
          </p>

          {/* Cartões de tema lado a lado, com pré-visualização */}
          <div className="grid grid-cols-2 gap-3">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleThemeChange(option.id)}
                  className={cn(
                    'relative text-left rounded-xl border p-3 transition-all',
                    isActive
                      ? 'border-[#00a884] bg-[#2a3942] ring-1 ring-[#00a884]/50'
                      : 'border-[#374248] bg-[#202c33] hover:border-[#00a884]/50',
                  )}
                >
                  {isActive && (
                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#00a884] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}

                  {/* Mini pré-visualização do tema */}
                  <div
                    className={cn(
                      'h-16 rounded-lg mb-2 overflow-hidden border border-black/20',
                      option.id === 'ios' ? 'bg-[#eef0f4]' : 'bg-[#0b141a]',
                    )}
                  >
                    <div
                      className={cn('h-4', option.id === 'ios' ? 'bg-white/85' : 'bg-[#202c33]')}
                    />
                    <div className="p-1.5 space-y-1.5">
                      <div
                        className={cn(
                          'h-3 w-2/3 rounded-full',
                          option.id === 'ios' ? 'bg-[#d9fdd3]' : 'bg-[#005c4b]',
                        )}
                      />
                      <div
                        className={cn(
                          'h-3 w-1/2 rounded-full ml-auto',
                          option.id === 'ios' ? 'bg-white' : 'bg-[#202c33]',
                        )}
                      />
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-slate-100 flex items-center">
                    {option.id === 'ios' ? (
                      <Smartphone className="w-3.5 h-3.5 mr-1.5 text-[#34c759]" />
                    ) : (
                      <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-[#00a884]" />
                    )}
                    {option.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {option.description}
                  </p>
                </button>
              )
            })}
          </div>

          {appliedFlash && (
            <p className="mt-2.5 text-[11px] text-[#00a884] flex items-center animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Tema {THEME_OPTIONS.find((t) => t.id === appliedFlash)?.label} aplicado em todo o app.
            </p>
          )}
        </section>

        {/* TAMANHO DA FONTE */}
        <section>
          <div className="flex items-center space-x-2 mb-3">
            <Type className="w-4 h-4 text-[#00a884]" />
            <h3 className="text-sm font-semibold text-slate-100">Tamanho da fonte</h3>
          </div>
          <div className="flex bg-[#202c33] rounded-lg p-0.5">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFontScale(option.id)}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
                  fontScale === option.id
                    ? 'bg-[#2a3942] text-white'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {/* Sobre */}
        <section className="pt-2 border-t border-[#222d34]">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            WhatsApp Clone — demonstração com dados de exemplo. As preferências (tema, tamanho de
            fonte e estágios do CRM) são salvas apenas neste navegador.
          </p>
        </section>
      </div>
    </div>
  )
}
