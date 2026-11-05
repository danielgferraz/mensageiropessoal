import React, { useEffect, useState } from 'react'
import {
  MessageSquare,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  Settings,
  Sparkles,
  QrCode,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Painéis que podem ficar ativos na área esquerda do app
export type LeftPanel = 'chats' | 'contacts' | 'new-group' | 'profile' | 'settings'

interface FeatureRailProps {
  activePanel: LeftPanel
  onSelect: (panel: LeftPanel) => void
  onOpenNewInstance?: () => void
  onOpenAntigravity?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

interface RailItem {
  id: LeftPanel
  label: string
  icon: React.ElementType
  hint: string
}

// Itens funcionais do menu lateral recolhível
const RAIL_ITEMS: RailItem[] = [
  { id: 'chats', label: 'Conversas', icon: MessageSquare, hint: 'Ir para as conversas' },
  { id: 'contacts', label: 'Contatos e CRM', icon: Users, hint: 'Contatos e pipeline de clientes' },
  { id: 'settings', label: 'Configurações', icon: Settings, hint: 'Preferências do aplicativo' },
]

// Espaço reservado para futuras funcionalidades
const COMING_SOON_ITEMS = [{ label: 'Mensagens favoritas', icon: Star }]

export const FeatureRail: React.FC<FeatureRailProps> = ({
  activePanel,
  onSelect,
  onOpenNewInstance,
  onOpenAntigravity,
  mobileOpen = false,
  onMobileClose,
}) => {
  // Estado recolhido/expandido persistido entre sessões (desktop)
  const [open, setOpen] = useState<boolean>(
    () => localStorage.getItem('wa_clone_rail_open') !== '0',
  )

  useEffect(() => {
    localStorage.setItem('wa_clone_rail_open', open ? '1' : '0')
  }, [open])

  const handleItemClick = (id: LeftPanel) => {
    onSelect(id)
    if (onMobileClose) {
      onMobileClose()
    }
  }

  return (
    <>
      {/* Backdrop para mobile gaveta sobreposta */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Barra lateral: no desktop fica fixo ao lado; no mobile abre como gaveta sobreposta */}
      <div
        className={cn(
          'flex flex-col h-full bg-[#0b141a] border-r border-[#222d34] text-slate-300 transition-all duration-200 ease-in-out',
          // Desktop: posicionado no fluxo flex
          'hidden md:flex md:static md:z-auto',
          open ? 'md:w-[230px]' : 'md:w-[64px]',
          // Mobile: gaveta deslizante sobreposta
          mobileOpen &&
            'flex fixed top-0 bottom-0 left-0 w-[270px] z-50 shadow-2xl animate-in slide-in-from-left duration-200',
        )}
      >
        {/* Cabeçalho do menu */}
        <div className="h-16 flex items-center justify-between px-3 wa-header-sidebar shrink-0">
          <div className="flex items-center min-w-0">
            <button
              type="button"
              onClick={() => {
                if (mobileOpen && onMobileClose) {
                  onMobileClose()
                } else {
                  setOpen((v) => !v)
                }
              }}
              title={open ? 'Recolher menu' : 'Expandir menu'}
              className="w-9 h-9 flex items-center justify-center rounded-full wa-header-btn shrink-0"
            >
              {open || mobileOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>
            {(open || mobileOpen) && (
              <div className="flex items-center space-x-1.5 ml-2 min-w-0">
                <Sparkles className="w-4 h-4 text-[#00a884] shrink-0" />
                <span className="text-sm font-semibold wa-header-title truncate">
                  Funcionalidades
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Itens de funcionalidade */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {RAIL_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              activePanel === item.id ||
              (item.id === 'chats' && (activePanel === 'new-group' || activePanel === 'profile'))

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                title={item.hint}
                className={cn(
                  'relative w-full flex items-center rounded-lg py-3 px-3 transition-colors text-left',
                  isActive
                    ? 'bg-[#2a3942] text-white'
                    : 'text-slate-400 hover:bg-[#202c33] hover:text-slate-200',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#00a884]" />
                )}
                <Icon className={cn('w-5 h-5 shrink-0', isActive && 'text-[#00a884]')} />
                {(open || mobileOpen) && (
                  <span className="ml-3 text-sm font-medium truncate">{item.label}</span>
                )}
              </button>
            )
          })}

          {/* Atalhos Rápidos Integrados: WhatsApp & Antigravity */}
          <div className="pt-3 mt-2 border-t border-[#222d34] space-y-1">
            {(open || mobileOpen) && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#00a884]">
                Integrações VPS
              </p>
            )}

            {onOpenNewInstance && (
              <button
                type="button"
                onClick={() => {
                  onOpenNewInstance()
                  if (onMobileClose) onMobileClose()
                }}
                title="Nova instância do WhatsApp (QR Code)"
                className="w-full flex items-center rounded-lg py-2.5 px-3 transition-colors text-left text-slate-300 hover:bg-[#202c33] hover:text-white group"
              >
                <QrCode className="w-5 h-5 shrink-0 text-[#00a884] group-hover:scale-110 transition-transform" />
                {(open || mobileOpen) && (
                  <span className="ml-3 text-sm font-medium truncate">Nova Instância WhatsApp</span>
                )}
              </button>
            )}

            {onOpenAntigravity && (
              <button
                type="button"
                onClick={() => {
                  onOpenAntigravity()
                  if (onMobileClose) onMobileClose()
                }}
                title="Abrir chat com o Antigravity Copilot"
                className="w-full flex items-center rounded-lg py-2.5 px-3 transition-colors text-left text-slate-300 hover:bg-[#202c33] hover:text-white group"
              >
                <Bot className="w-5 h-5 shrink-0 text-cyan-400 group-hover:scale-110 transition-transform" />
                {(open || mobileOpen) && (
                  <span className="ml-3 text-sm font-medium truncate">Antigravity Copilot</span>
                )}
              </button>
            )}
          </div>

          {/* Em breve: espaço para novas funcionalidades */}
          <div className="pt-3 mt-2 border-t border-[#222d34]">
            {(open || mobileOpen) && (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Em breve
              </p>
            )}
            {COMING_SOON_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  title={`${item.label} — em breve`}
                  className="w-full flex items-center rounded-lg py-2 px-3 opacity-40 cursor-not-allowed select-none"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {(open || mobileOpen) && (
                    <span className="ml-3 text-sm truncate">{item.label}</span>
                  )}
                </div>
              )
            })}
          </div>
        </nav>

        {/* Rodapé do menu */}
        {(open || mobileOpen) && (
          <div className="px-4 py-3 border-t border-[#222d34] shrink-0">
            <p className="text-[11px] leading-snug text-slate-500">
              WhatsApp Web Clone • Menu mobile e atalhos rápidos.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
