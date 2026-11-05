import React, { useState, useEffect } from 'react'
import { MessageSquarePlus, Users, UserPlus, Tag, X, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FabActionOption {
  id: 'new-chat' | 'new-group' | 'new-contact' | 'new-label'
  label: string
  description?: string
  icon: React.ElementType
  onClick: () => void
  colorClass?: string
}

interface SystemFabMenuProps {
  onNewChat: () => void
  onNewGroup: () => void
  onNewContact: () => void
  onNewLabel: () => void
  className?: string
}

export const SystemFabMenu: React.FC<SystemFabMenuProps> = ({
  onNewChat,
  onNewGroup,
  onNewContact,
  onNewLabel,
  className,
}) => {
  const [open, setOpen] = useState(false)

  // Fecha o menu ao pressionar Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const options: FabActionOption[] = [
    {
      id: 'new-chat',
      label: 'Nova conversa',
      description: 'Iniciar chat com contato',
      icon: MessageSquarePlus,
      onClick: () => {
        setOpen(false)
        onNewChat()
      },
      colorClass: 'wa-fab-item-chat',
    },
    {
      id: 'new-group',
      label: 'Novo grupo',
      description: 'Criar grupo com participantes',
      icon: Users,
      onClick: () => {
        setOpen(false)
        onNewGroup()
      },
      colorClass: 'wa-fab-item-group',
    },
    {
      id: 'new-contact',
      label: 'Novo contato',
      description: 'Adicionar à agenda e CRM',
      icon: UserPlus,
      onClick: () => {
        setOpen(false)
        onNewContact()
      },
      colorClass: 'wa-fab-item-contact',
    },
    {
      id: 'new-label',
      label: 'Nova etiqueta',
      description: 'Gerenciar etiquetas e cores',
      icon: Tag,
      onClick: () => {
        setOpen(false)
        onNewLabel()
      },
      colorClass: 'wa-fab-item-label',
    },
  ]

  return (
    <div
      className={cn(
        'md:hidden fixed bottom-5 right-5 z-40 flex flex-col items-end select-none pointer-events-none',
        className,
      )}
    >
      {/* Backdrop tocável para fechar */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-10 pointer-events-auto transition-opacity duration-200 animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Itens da bolha empilhados de baixo para cima */}
      <div
        className={cn(
          'relative z-20 flex flex-col items-end space-y-3 mb-3 pointer-events-auto transition-all duration-200',
          open
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none scale-95 origin-bottom-right',
        )}
      >
        {options.map((opt, idx) => {
          const Icon = opt.icon
          // Animação cascata suave
          const delayStyle = {
            transitionDelay: open ? `${(options.length - 1 - idx) * 35}ms` : '0ms',
          }

          return (
            <div
              key={opt.id}
              style={delayStyle}
              onClick={opt.onClick}
              className={cn(
                'group flex items-center space-x-2.5 cursor-pointer transform transition-all duration-200 active:scale-95',
                open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              {/* Rótulo à esquerda no balão de texto (bubble pill) */}
              <span className="wa-fab-pill px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg whitespace-nowrap transition-transform group-hover:scale-105">
                {opt.label}
              </span>

              {/* Botão circular de ação secundário */}
              <button
                type="button"
                className={cn(
                  'wa-fab-bubble-btn w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 active:scale-90',
                  opt.colorClass,
                )}
                title={opt.label}
                aria-label={opt.label}
              >
                <Icon className="w-5 h-5" />
              </button>
            </div>
          )
        })}
      </div>

      {/* FAB principal estilo WhatsApp */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'wa-fab-main relative z-20 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl pointer-events-auto cursor-pointer transition-all duration-300 active:scale-90',
          open ? 'wa-fab-main-open rotate-90' : 'hover:scale-105',
        )}
        title={open ? 'Fechar opções' : 'Opções do WhatsApp'}
        aria-label={open ? 'Fechar opções' : 'Opções do WhatsApp'}
        aria-expanded={open}
      >
        <span
          className={cn(
            'flex items-center justify-center transition-transform duration-300',
            open ? 'rotate-45' : 'rotate-0',
          )}
        >
          {open ? (
            <X className="w-6 h-6 text-white stroke-[2.5]" />
          ) : (
            <MessageCircle className="w-7 h-7 text-white stroke-[2.2] fill-current/10" />
          )}
        </span>
      </button>
    </div>
  )
}
