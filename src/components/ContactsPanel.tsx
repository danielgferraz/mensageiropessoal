import React, { useState } from 'react'
import { ArrowLeft, UserPlus, Search, MessageCircle, Phone, Check } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface ContactsPanelProps {
  onClose: () => void
}

export const ContactsPanel: React.FC<ContactsPanelProps> = ({ onClose }) => {
  const { contacts, addContact, startChatWithContact } = useWhatsApp()
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAbout, setNewAbout] = useState('')

  const { toast } = useToast()

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase()),
  )

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newPhone.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o número de telefone.',
        variant: 'destructive',
      })
      return
    }

    const created = addContact(newName.trim(), newPhone.trim(), newAbout.trim() || undefined)

    toast({
      title: 'Contato adicionado!',
      description: `${created.name} já pode receber suas mensagens.`,
    })

    setIsAddOpen(false)
    setNewName('')
    setNewPhone('')
    setNewAbout('')
  }

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
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => handleStartConversation(contact.id)}
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
                  <MessageCircle className="w-4 h-4 text-slate-400 opacity-60 hover:opacity-100" />
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{contact.phone}</p>
                {contact.about && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{contact.about}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal to add contact */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#222e35] border-[#2f3b43] text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-[#00a884]" />
              <span>Novo Contato</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateContact} className="space-y-4 py-2">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Nome completo <span className="text-[#00a884]">*</span>
              </label>
              <Input
                placeholder="Ex: Gabriela Duarte"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#2a3942] border-[#374248] text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Número de telefone <span className="text-[#00a884]">*</span>
              </label>
              <Input
                placeholder="+55 11 99999-8888"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="bg-[#2a3942] border-[#374248] text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Recado / Status</label>
              <Input
                placeholder="Disponível para trocar ideias"
                value={newAbout}
                onChange={(e) => setNewAbout(e.target.value)}
                className="bg-[#2a3942] border-[#374248] text-white"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#00a884] hover:bg-[#008f6f] text-white">
                Salvar Contato
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
