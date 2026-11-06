import React, { useState } from 'react'
import {
  ArrowLeft,
  Moon,
  Sun,
  Trees,
  Smartphone,
  Palette,
  Type,
  Check,
  Sparkles,
  Sliders,
  Activity,
  Server,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { useAppTheme, AppTheme, FontScale } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { LogsSettingsTab } from '@/components/LogsSettingsTab'
import { ConnectionsSettingsTab } from '@/components/ConnectionsSettingsTab'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SettingsPanelProps {
  onClose: () => void
  onOpenMobileMenu?: () => void
}

const THEME_OPTIONS: {
  id: AppTheme
  label: string
  description: string
  icon: typeof LayoutGrid
  headerColor: string
  bodyColor: string
  bubbleColor: string
}[] = [
  {
    id: 'classic',
    label: 'Clássico',
    description: 'O visual escuro tradicional do WhatsApp Web.',
    icon: LayoutGrid,
    headerColor: 'bg-[#202c33]',
    bodyColor: 'bg-[#0b141a]',
    bubbleColor: 'bg-[#005c4b]',
  },
  {
    id: 'ios',
    label: 'iOS Claro',
    description: 'Frosted glass, cantos suaves e tons claros do sistema Apple.',
    icon: Smartphone,
    headerColor: 'bg-white/85',
    bodyColor: 'bg-[#efeae2]',
    bubbleColor: 'bg-[#d9fdd3]',
  },
  {
    id: 'amoled',
    label: 'AMOLED',
    description: 'Preto puro (#000000) de alto contraste e máxima economia.',
    icon: Moon,
    headerColor: 'bg-[#0a0a0a]',
    bodyColor: 'bg-[#000000]',
    bubbleColor: 'bg-[#003e33]',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    description: 'Verde floresta nobre e profundo com alto contraste elegante.',
    icon: Trees,
    headerColor: 'bg-[#0b2923]',
    bodyColor: 'bg-[#061e1b]',
    bubbleColor: 'bg-[#044b3c]',
  },
]

const FONT_OPTIONS: { id: FontScale; label: string }[] = [
  { id: 'small', label: 'Pequena' },
  { id: 'medium', label: 'Média' },
  { id: 'large', label: 'Grande' },
]

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onOpenMobileMenu }) => {
  const { logs, connections, resetData } = useWhatsApp()
  const { theme, setTheme, fontScale, setFontScale } = useAppTheme()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'general' | 'logs' | 'connections'>('general')
  const [appliedFlash, setAppliedFlash] = useState<AppTheme | null>(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  const handleThemeChange = (next: AppTheme) => {
    setTheme(next)
    setAppliedFlash(next)
    setTimeout(() => setAppliedFlash(null), 1800)
  }

  const handleConfirmReset = () => {
    resetData()
    setConfirmResetOpen(false)
    toast({
      title: 'Dados restaurados',
      description: 'Dados locais limpos; as conversas serão recarregadas do WhatsApp.',
    })
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] wa-panel-separator-right text-slate-100 z-30 shrink-0 shadow-2xl animate-in slide-in-from-left duration-200">
      {/* Cabeçalho — Painel lateral esquerdo de Configurações */}
      <div className="h-16 px-4 wa-header-sidebar flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full wa-header-btn -ml-2"
            title="Voltar para as conversas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-semibold wa-header-title">Configurações</h2>
            <p className="text-[11px] wa-header-subtitle">Aparência, logs e conexões</p>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas no Topo — amigável ao toque e sticky */}
      <div className="px-3 pt-2.5 pb-2 bg-[#111b21] shrink-0 sticky top-0 z-10 border-b border-[#222d34]">
        <div className="grid grid-cols-3 bg-[#202c33] p-1 rounded-xl border border-[#2a3942] gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={cn(
              'flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95',
              activeTab === 'general'
                ? 'bg-[#00a884] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Geral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95',
              activeTab === 'logs'
                ? 'bg-[#00a884] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Logs</span>
            {logs.length > 0 && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  activeTab === 'logs' ? 'bg-white/20 text-white' : 'bg-[#2a3942] text-slate-300',
                )}
              >
                {logs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={cn(
              'flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95',
              activeTab === 'connections'
                ? 'bg-[#00a884] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Conexões</span>
            {connections.length > 0 && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  activeTab === 'connections'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#00a884] text-white',
                )}
              >
                {connections.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'logs' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <LogsSettingsTab />
        </div>
      ) : activeTab === 'connections' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ConnectionsSettingsTab />
        </div>
      ) : (
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
                        'h-16 rounded-lg mb-2 overflow-hidden border border-black/30',
                        option.bodyColor,
                      )}
                    >
                      <div className={cn('h-4', option.headerColor)} />
                      <div className="p-1.5 space-y-1.5">
                        <div className={cn('h-3 w-2/3 rounded-full', option.bubbleColor)} />
                        <div
                          className={cn(
                            'h-3 w-1/2 rounded-full ml-auto',
                            option.id === 'ios' ? 'bg-white' : 'bg-white/10',
                          )}
                        />
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-100 flex items-center">
                      <option.icon className="w-3.5 h-3.5 mr-1.5 text-[#00a884]" />
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
                Tema {THEME_OPTIONS.find((t) => t.id === appliedFlash)?.label} aplicado em todo o
                app.
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

          {/* Reset de Dados */}
          <section className="pt-2 border-t border-[#222d34] space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmResetOpen(true)}
              className="w-full bg-[#182229] border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10 space-x-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar dados locais</span>
            </Button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Preferências, etiquetas, respostas rápidas, notas internas e logs são salvos neste navegador. A conexão WhatsApp é gerenciada pelo servidor.
            </p>
          </section>
        </div>
      )}

      {/* Confirmação de Reset de Dados */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 w-[95vw] max-w-sm rounded-2xl p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-slate-100">
              Limpar dados deste navegador?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed">
              As notas internas, etiquetas, respostas rápidas, estágios de contatos e logs locais serão apagados. Conversas reais serão recarregadas do WhatsApp; mensagens no celular e conexões no servidor não serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2 pt-2">
            <AlertDialogCancel
              onClick={() => setConfirmResetOpen(false)}
              className="bg-transparent border-[#374248] text-slate-300 hover:bg-[#2a3942] hover:text-white text-xs h-10 w-full sm:w-auto mt-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-10 w-full sm:w-auto"
            >
              Limpar dados locais
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
