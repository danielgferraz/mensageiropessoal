import React from 'react'
import { X, Users, UserPlus, ShieldAlert, BellOff, LogOut, Info } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface GroupInfoPanelProps {
  conversationId: string
  onClose: () => void
}

export const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({ conversationId, onClose }) => {
  const { conversations, contacts, user, startChatWithContact } = useWhatsApp()
  const { toast } = useToast()

  const conversation = conversations.find((c) => c.id === conversationId)

  if (!conversation) return null

  const participantContacts = (conversation.participants || []).map((id) =>
    contacts.find((c) => c.id === id),
  )

  return (
    <div className="w-full sm:w-[340px] md:w-[380px] h-full bg-[#111b21] wa-panel-separator-left text-slate-100 flex flex-col z-20 shrink-0">
      {/* Top Header — Cabeçalho lateral direito de dados do grupo */}
      <div className="h-16 px-4 wa-header-drawer flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="wa-header-btn rounded-full -ml-2"
          title="Fechar dados do grupo"
        >
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-base font-semibold wa-header-title">Dados do grupo</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Group Avatar and Name */}
        <div className="bg-[#182229] p-6 rounded-xl border border-[#2a3942] flex flex-col items-center text-center">
          <img
            src={conversation.avatar}
            alt={conversation.name}
            className="w-28 h-28 rounded-full object-cover shadow-lg mb-3"
          />
          <h3 className="text-lg font-semibold text-slate-100">{conversation.name}</h3>
          <p className="text-xs text-slate-400 mt-1">
            Grupo • {(conversation.participants?.length || 0) + 1} participantes
          </p>
        </div>

        {/* Group description */}
        <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942] text-xs text-slate-300">
          <p className="text-[#00a884] font-medium mb-1">Descrição</p>
          <p className="text-slate-400">
            Grupo de alinhamento e compartilhamento de ideias, fotos e novidades da equipe.
          </p>
        </div>

        {/* Participants section */}
        <div className="bg-[#182229] rounded-xl border border-[#2a3942] overflow-hidden">
          <div className="p-3 border-b border-[#2a3942] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider">
              {(conversation.participants?.length || 0) + 1} participantes
            </span>
          </div>

          <div className="divide-y divide-[#202c33]">
            {/* Me */}
            <div className="p-3 flex items-center space-x-3">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200">Você</p>
                  <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-slate-400">{user.about}</p>
              </div>
            </div>

            {/* Other participants */}
            {participantContacts.map((c) => {
              if (!c) return null
              return (
                <div
                  key={c.id}
                  className="p-3 flex items-center space-x-3 hover:bg-[#202c33] cursor-pointer transition-colors"
                  onClick={() => {
                    startChatWithContact(c.id)
                    onClose()
                  }}
                >
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">{c.phone}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="bg-[#182229] rounded-xl border border-[#2a3942] divide-y divide-[#202c33]">
          <button
            type="button"
            onClick={() =>
              toast({
                title: 'Silenciar grupo',
                description: 'Grupo silenciado por 8 horas (simulação).',
              })
            }
            className="w-full p-3 flex items-center space-x-3 text-slate-300 hover:text-white hover:bg-[#202c33] transition-colors text-sm"
          >
            <BellOff className="w-4 h-4 text-slate-400" />
            <span>Silenciar notificações</span>
          </button>

          <button
            type="button"
            onClick={() => {
              toast({
                title: 'Sair do grupo',
                description: 'Recurso simulado de saída de grupo.',
              })
              onClose()
            }}
            className="w-full p-3 flex items-center space-x-3 text-red-400 hover:text-red-300 hover:bg-[#202c33] transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do grupo</span>
          </button>
        </div>
      </div>
    </div>
  )
}
