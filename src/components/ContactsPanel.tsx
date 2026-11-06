import React, { useState } from 'react'
import { ArrowLeft, UserPlus, Search, MessageCircle } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Contact } from '@/types/whatsapp'
import { CRM_STAGES } from '@/data/crmData'
import { ContactDetailsModal } from '@/components/ContactDetailsModal'
import { NewContactDialog } from '@/components/NewContactDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ContactsPanelProps {
  onClose: () => void
}

export const ContactsPanel: React.FC<ContactsPanelProps> = ({ onClose }) => {
  const { contacts, crmStages, startChatWithContact } = useWhatsApp()
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase()),
  )

  const handleStartConversation = (contactId: string) => {
    startChatWithContact(contactId)
    onClose()
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] border-r border-[#222d34] text-slate-100 z-30 shrink-0">
      {/* Header */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center space-x-4 border-b border-[#2a3942]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-slate-300 hover:text-white -ml-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-base font-semibold">Novo chat / Contatos</h2>
      </div>

      {/* Add new contact action button */}
      <div className="p-3 border-b border-[#222d34]">
        <Button
          onClick={() => setIsAddOpen(true)}
          className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center space-x-2 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Adicionar Novo Contato</span>
        </Button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#222d34]">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar contatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#202c33] border-none text-white placeholder-slate-400 h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#00a884]">
          Contatos no WhatsApp ({filteredContacts.length})
        </div>

        {filteredContacts.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-sm">
            Nenhum contato encontrado com "{search}".
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const stage = crmStages[contact.id]
            const stageConfig = stage ? CRM_STAGES.find((s) => s.id === stage) : null

            return (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="flex items-center px-4 py-3 hover:bg-[#202c33] cursor-pointer transition-colors"
              >
                <div className="relative shrink-0 mr-3">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  {contact.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border border-[#111b21]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-100 truncate">{contact.name}</h3>
                    <div className="flex items-center space-x-2 shrink-0">
                      {stage ? (
                        <span
                          className={`flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#202c33] border border-[#2a3942] text-slate-300`}
                          title="Estágio no CRM"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageConfig?.dot || 'bg-sky-400'} mr-1`} />
                          {stageConfig?.label || stage}
                        </span>
                      ) : (
                        <span
                          className={`flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#182229] border border-[#222d34] text-slate-500`}
                          title="Fora do pipeline"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1" />
                          Sem estágio
                        </span>
                      )}
                      <MessageCircle
                        className="w-4 h-4 text-slate-400 opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartConversation(contact.id)
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{contact.phone}</p>
                  {contact.about && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{contact.about}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal de detalhes do contato */}
      <ContactDetailsModal
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        onOpenChat={(id) => {
          setSelectedContact(null)
          handleStartConversation(id)
        }}
      />

      {/* Modal to add contact */}
      <NewContactDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onContactCreated={(created) => setSelectedContact(created)}
      />
    </div>
  )
}
