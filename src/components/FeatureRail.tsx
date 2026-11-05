import React, { useEffect, useState } from 'react'
import {
  MessageSquare,
  Users,
  KanbanSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  Settings,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Painéis que podem ficar ativos na área esquerda do app
export type LeftPanel = 'chats' | 'contacts' | 'new-group' | 'profile' | 'crm'

interface FeatureRailProps {
  activePanel: LeftPanel
  onSelect: (panel: LeftPanel) => void
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
  { id: 'contacts', label: 'Contatos', icon: Users, hint: 'Gerenciar contatos' },
  { id: 'crm', label: 'CRM', icon: KanbanSquare, hint: 'Pipeline de clientes' },
]

// Espaço reservado para futuras funcionalidades
const COMING_SOON_ITEMS = [
  { label: 'Mensagens favoritas', icon: Star },
  { label: 'Configurações', icon: Settings },
]

export const FeatureRail: React.FC<FeatureRailProps> = ({ activePanel, onSelect }) => {
  // Estado recolhido/expandido persistido entre sessões
  const [open, setOpen] = useState<boolean>(
    () => localStorage.getItem('wa_clone_rail_open') !== '0',
  )

  useEffect(() => {
    localStorage.setItem('wa_clone_rail_open', open ? '1' : '0')
  }, [open])

  return (
    <div
      className={cn(
        'flex flex-col h-full shrink-0 bg-[#0b141a] border-r border-[#222d34] text-slate-300 transition-[width] duration-200 ease-in-out',
        // No celular o menu fica sempre no modo compacto (apenas ícones)
        open ? 'w-[64px] md:w-[230px]' : 'w-[64px]',
      )}
    >
      {/* Cabeçalho do menu */}
      <div className="h-16 flex items-center px-3 border-b border-[#222d34]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Recolher menu' : 'Expandir menu'}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#374248]/50 hover:text-white transition-colors shrink-0"
        >
          {open ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </button>
        {open && (
          <div className="hidden md:flex items-center space-x-1.5 ml-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#00a884] shrink-0" />
            <span className="text-sm font-semibold text-slate-200 truncate">Funcionalidades</span>
          </div>
        )}
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
              onClick={() => onSelect(item.id)}
              title={item.hint}
              className={cn(
                'relative w-full flex items-center rounded-lg py-2.5 px-3 transition-colors text-left',
                isActive
                  ? 'bg-[#2a3942] text-white'
                  : 'text-slate-400 hover:bg-[#202c33] hover:text-slate-200',
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#00a884]" />
              )}
              <Icon className={cn('w-5 h-5 shrink-0', isActive && 'text-[#00a884]')} />
              {open && (
                <span className="hidden md:block ml-3 text-sm font-medium truncate">
                  {item.label}
                </span>
              )}
            </button>
          )
        })}

        {/* Em breve: espaço para novas funcionalidades */}
        <div className="pt-4 mt-2 border-t border-[#222d34]">
          {open && (
            <p className="hidden md:block px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Em breve
            </p>
          )}
          {COMING_SOON_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                title={`${item.label} — em breve`}
                className="w-full flex items-center rounded-lg py-2.5 px-3 opacity-40 cursor-not-allowed select-none"
              >
                <Icon className="w-5 h-5 shrink-0" />
                {open && (
                  <span className="hidden md:block ml-3 text-sm truncate">{item.label}</span>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Rodapé do menu */}
      {open && (
        <div className="hidden md:block px-4 py-3 border-t border-[#222d34]">
          <p className="text-[11px] leading-snug text-slate-500">
            Menu de funcionalidades do WhatsApp Clone. Novos recursos aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  )
}
