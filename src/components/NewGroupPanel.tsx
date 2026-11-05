import React, { useState } from 'react'
import { ArrowLeft, Users, Check, Search, Sparkles, Camera } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface NewGroupPanelProps {
  onClose: () => void
  onGroupCreated: (groupId: string) => void
}

const GROUP_AVATAR_TEMPLATES = [
  'https://img.usecurling.com/p/200/200?q=teamwork&color=blue',
  'https://img.usecurling.com/p/200/200?q=pizza&color=orange',
  'https://img.usecurling.com/p/200/200?q=party&color=purple',
  'https://img.usecurling.com/p/200/200?q=code&color=green',
]

export const NewGroupPanel: React.FC<NewGroupPanelProps> = ({ onClose, onGroupCreated }) => {
  const { contacts, createGroup, setActiveChatId } = useWhatsApp()
  const [step, setStep] = useState<'participants' | 'details'>('participants')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [groupName, setGroupName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(GROUP_AVATAR_TEMPLATES[0])

  const { toast } = useToast()

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleNextStep = () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Selecione participantes',
        description: 'Adicione pelo menos 1 contato para criar o grupo.',
        variant: 'destructive',
      })
      return
    }
    setStep('details')
  }

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) {
      toast({
        title: 'Nome do grupo obrigatório',
        description: 'Informe um assunto para o grupo.',
        variant: 'destructive',
      })
      return
    }

    const newGroupId = createGroup(groupName.trim(), selectedIds, selectedAvatar)

    setActiveChatId(newGroupId)
    onGroupCreated(newGroupId)

    toast({
      title: 'Grupo criado com sucesso!',
      description: `O grupo "${groupName.trim()}" está pronto.`,
    })
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] wa-panel-separator-right text-slate-100 z-30 shrink-0">
      {/* Header — Painel lateral esquerdo de Novo Grupo */}
      <div className="h-16 px-4 wa-header-sidebar flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={step === 'details' ? () => setStep('participants') : onClose}
          className="wa-header-btn rounded-full -ml-2"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-base font-semibold wa-header-title">Novo grupo</h2>
          <p className="text-xs wa-header-subtitle">
            {step === 'participants'
              ? `${selectedIds.length} selecionados`
              : 'Definir nome do grupo'}
          </p>
        </div>
      </div>

      {step === 'participants' ? (
        <>
          {/* Selected chips strip */}
          {selectedIds.length > 0 && (
            <div className="p-3 bg-[#182229] border-b border-[#222d34] flex items-center gap-2 overflow-x-auto">
              {selectedIds.map((id) => {
                const c = contacts.find((item) => item.id === id)
                if (!c) return null
                return (
                  <div
                    key={id}
                    onClick={() => toggleSelect(id)}
                    className="flex items-center space-x-1.5 bg-[#202c33] border border-[#2f3b43] text-xs px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-950/40 hover:border-red-500/50 transition-colors shrink-0"
                    title="Clique para remover"
                  >
                    <img src={c.avatar} alt={c.name} className="w-4 h-4 rounded-full" />
                    <span className="truncate max-w-[90px]">{c.name}</span>
                    <span className="text-slate-400 hover:text-red-400 text-sm">×</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Search Contacts */}
          <div className="p-3 border-b border-[#222d34]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Pesquisar contatos para adicionar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#202c33] border-none text-white placeholder-slate-400 h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
              />
            </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
            {filteredContacts.map((contact) => {
              const isSelected = selectedIds.includes(contact.id)
              return (
                <div
                  key={contact.id}
                  onClick={() => toggleSelect(contact.id)}
                  className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                  }`}
                >
                  <div className="relative shrink-0 mr-3">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute -bottom-1 -right-1 bg-[#00a884] rounded-full p-0.5 border border-[#111b21]">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-100 truncate">{contact.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{contact.phone}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Next Action */}
          <div className="p-4 bg-[#202c33] border-t border-[#2a3942] flex justify-end">
            <Button
              onClick={handleNextStep}
              className="bg-[#00a884] hover:bg-[#008f6f] text-white px-6 font-medium"
            >
              Avançar ({selectedIds.length})
            </Button>
          </div>
        </>
      ) : (
        /* Details Step */
        <form
          onSubmit={handleCreateGroup}
          className="flex-1 flex flex-col justify-between p-6 space-y-6"
        >
          <div className="space-y-6">
            <div className="text-center">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Ícone do Grupo
              </label>
              <div className="flex justify-center gap-3">
                {GROUP_AVATAR_TEMPLATES.map((avatar, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`rounded-full p-1 transition-all ${
                      selectedAvatar === avatar
                        ? 'ring-2 ring-[#00a884] scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={avatar}
                      alt="Ícone de grupo"
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nome do grupo <span className="text-[#00a884]">*</span>
              </label>
              <Input
                placeholder="Ex: Família & Amigos, Projeto Novo"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-[#2a3942] border-[#374248] text-white h-11"
                autoFocus
                required
              />
            </div>

            <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942] space-y-2">
              <p className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-[#00a884]" />
                <span>Participantes ({selectedIds.length})</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedIds.map((id) => {
                  const c = contacts.find((item) => item.id === id)
                  return (
                    <span
                      key={id}
                      className="text-xs bg-[#202c33] text-slate-300 px-2.5 py-1 rounded-full border border-[#2f3b43]"
                    >
                      {c?.name}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('participants')}
              className="flex-1 text-slate-300 hover:text-white"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#00a884] hover:bg-[#008f6f] text-white font-medium"
            >
              Criar Grupo
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
