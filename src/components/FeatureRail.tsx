import React, { useEffect, useRef, useState } from 'react'
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
  Download,
  LogOut,
  ShieldCheck,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

// Painéis que podem ficar ativos na área esquerda do app
export type LeftPanel = 'chats' | 'contacts' | 'menus' | 'new-group' | 'profile' | 'settings'

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
  { id: 'menus', label: 'Menus e botões', icon: ListChecks, hint: 'Monte menus que você envia nas conversas' },
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
  const { user, logout } = useAuth()
  // Estado recolhido/expandido persistido entre sessões (desktop)
  const [open, setOpen] = useState<boolean>(
    () => {
      const saved = localStorage.getItem('wa_clone_rail_open')
      return saved === null ? window.innerWidth >= 1280 : saved !== '0'
    },
  )
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const closeMobileRef = useRef(onMobileClose)
  closeMobileRef.current = onMobileClose

  useEffect(() => {
    if (!mobileOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const rail = railRef.current
    const focusable = () => Array.from(rail?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') || [])
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileRef.current?.()
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const onResize = () => {
      if (window.innerWidth >= 768) closeMobileRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      previousFocus?.focus()
    }
  }, [mobileOpen])

  useEffect(() => {
    localStorage.setItem('wa_clone_rail_open', open ? '1' : '0')
  }, [open])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallApp = async () => {
    if (!installPrompt) {
      alert('Para instalar no seu celular ou computador:\n\n• No Chrome/Edge: clique no ícone de instalar na barra de endereços (ou Menu > Instalar Aplicativo).\n• No iPhone/Safari: clique no botão Compartilhar e selecione "Adicionar à Tela de Início".')
      return
    }
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

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
          aria-hidden="true"
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Barra lateral: no desktop fica fixo ao lado; no mobile abre como gaveta sobreposta */}
      <div
        ref={railRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Menu do Mensageiro"
        className={cn(
          'messenger-rail flex-col h-full shrink-0 bg-[#0b141a] border-r border-[#222d34] text-slate-300 transition-all duration-200 ease-in-out',
          // Desktop: posicionado no fluxo flex
          'md:flex md:static md:z-auto',
          open ? 'md:w-[230px]' : 'md:w-[64px]',
          // Mobile: gaveta deslizante sobreposta
          mobileOpen
            ? 'flex fixed top-0 bottom-0 left-0 w-[min(290px,90vw)] z-50 shadow-2xl animate-in slide-in-from-left duration-200'
            : 'hidden',
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
              aria-label={mobileOpen ? 'Fechar menu' : open ? 'Recolher menu' : 'Expandir menu'}
              aria-expanded={mobileOpen || open}
              className="w-11 h-11 flex items-center justify-center rounded-full wa-header-btn shrink-0"
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
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
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
                aria-label="Nova instância do WhatsApp"
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
                aria-label="Antigravity Copilot"
                className="w-full flex items-center rounded-lg py-2.5 px-3 transition-colors text-left text-slate-300 hover:bg-[#202c33] hover:text-white group"
              >
                <Bot className="w-5 h-5 shrink-0 text-cyan-400 group-hover:scale-110 transition-transform" />
                {(open || mobileOpen) && (
                  <span className="ml-3 text-sm font-medium truncate">Antigravity Copilot</span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleInstallApp}
              title="Instalar Mensageiro como aplicativo (PWA)"
              aria-label="Instalar aplicativo"
              className="w-full flex items-center rounded-lg py-2.5 px-3 transition-colors text-left text-slate-300 hover:bg-[#202c33] hover:text-white group"
            >
              <Download className="w-5 h-5 shrink-0 text-emerald-400 group-hover:scale-110 transition-transform" />
              {(open || mobileOpen) && (
                <span className="ml-3 text-sm font-medium truncate">Instalar App (PWA)</span>
              )}
            </button>
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

        {/* Rodapé do menu: Perfil de Admin e Sair */}
        {user && (
          <div className="px-3 py-3 border-t border-[#222d34] shrink-0 bg-[#0c1317]/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                {(open || mobileOpen) && (
                  <div className="min-w-0 flex-1 text-left leading-tight">
                    <p className="text-xs font-medium text-white truncate">
                      {user.fullName || user.email}
                    </p>
                    <span className="inline-block text-[10px] text-emerald-400 font-mono uppercase tracking-wide">
                      Admin
                    </span>
                  </div>
                )}
              </div>
              {(open || mobileOpen) && (
                <button
                  type="button"
                  onClick={logout}
                  title="Sair do Mensageiro"
                  aria-label="Sair do Mensageiro"
                  className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-[#202c33] rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
