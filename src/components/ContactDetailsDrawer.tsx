import React, { useState } from 'react'
import {
  X,
  Phone,
  MessageCircle,
  Pencil,
  Check,
  Maximize2,
  Clock,
  Briefcase,
  Sparkles,
} from 'lucide-react'
import { Contact, CrmStageId, MessageMedia } from '@/types/whatsapp'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { findStage, getStageLabelIn } from '@/data/crmData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { ContactNotesTab } from '@/components/ContactNotesTab'
import { FileText, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContactDetailsDrawerProps {
  contactId: string
  onClose: () => void
  onOpenFullscreenAvatar?: (media: MessageMedia) => void
}

export const ContactDetailsDrawer: React.FC<ContactDetailsDrawerProps> = ({
  contactId,
  onClose,
  onOpenFullscreenAvatar,
}) => {
  const {
    contacts,
    crmStages,
    setContactStage,
    updateContact,
    crmStageList,
    setActiveMedia,
    getNotesByContact,
  } = useWhatsApp()
  const { toast } = useToast()

  const contact = contacts.find((c) => c.id === contactId)

  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details')
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftAbout, setDraftAbout] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  React.useEffect(() => {
    if (contact) {
      setDraftName(contact.name || '')
      setDraftPhone(contact.phone || '')
      setDraftAbout(contact.about || '')
      setEditing(false)
    }
  }, [contact])

  if (!contact) return null

  const contactNotesCount = getNotesByContact(contact.id).length
  const stage: CrmStageId = crmStages[contact.id] || crmStageList[0]?.id || 'novo'
  const stageConfig = findStage(crmStageList, stage)

  const handleOpenFullscreen = () => {
    const avatarMedia: MessageMedia = {
      type: 'image',
      url: contact.avatar,
      fileName: `${contact.name} - Foto de perfil`,
      caption: `Foto de perfil de ${contact.name}`,
    }
    if (onOpenFullscreenAvatar) {
      onOpenFullscreenAvatar(avatarMedia)
    } else {
      setActiveMedia(avatarMedia)
    }
  }

  const handleSaveEdit = () => {
    if (!draftName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O contato precisa ter pelo menos um nome.',
        variant: 'destructive',
      })
      return
    }
    if (!draftPhone.trim()) {
      toast({
        title: 'Telefone obrigatório',
        description: 'O número de telefone não pode ficar vazio.',
        variant: 'destructive',
      })
      return
    }

    updateContact(contact.id, draftName.trim(), draftAbout.trim(), draftPhone.trim())
    setEditing(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
    toast({
      title: 'Contato atualizado',
      description: 'Alterações salvas com sucesso.',
    })
  }

  const handleMoveStage = (next: CrmStageId) => {
    if (next === stage) return
    setContactStage(contact.id, next)
    toast({
      title: 'Negócio atualizado',
      description: `${contact.name} movido para "${getStageLabelIn(crmStageList, next)}".`,
    })
  }

  return (
    <div className="w-full sm:w-[340px] md:w-[380px] h-full bg-[#111b21] wa-panel-separator-left text-slate-100 flex flex-col z-20 shrink-0 animate-fade-in shadow-2xl">
      {/* Top Header — Cabeçalho lateral direito de detalhes do contato */}
      <div className="h-16 px-4 wa-header-drawer flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="wa-header-btn rounded-full -ml-2"
          title="Fechar dados do contato"
        >
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-base font-semibold wa-header-title">Dados do contato</h2>
      </div>

      {/* Abas: Detalhes e Notas */}
      <div className="px-4 pt-3 pb-0 bg-[#111b21]">
        <div className="flex bg-[#202c33] p-1 rounded-lg border border-[#2a3942]">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={cn(
              'flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeTab === 'details'
                ? 'bg-[#2a3942] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <User className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Detalhes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={cn(
              'flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeTab === 'notes'
                ? 'bg-[#2a3942] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <FileText className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Notas</span>
            {contactNotesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#00a884] text-white">
                {contactNotesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'notes' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ContactNotesTab contactId={contact.id} contactName={contact.name} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Avatar Card com botão de tela cheia */}
          <div className="bg-[#182229] p-6 rounded-xl border border-[#2a3942] flex flex-col items-center text-center relative group">
            <div className="relative">
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-32 h-32 rounded-full object-cover shadow-xl ring-2 ring-white/10 group-hover:brightness-95 transition-all cursor-pointer"
                onClick={handleOpenFullscreen}
                title="Clique para ver a foto em tela cheia"
              />
              {/* Botão de abrir em tela cheia sobre a foto */}
              <button
                type="button"
                onClick={handleOpenFullscreen}
                className="absolute bottom-1 right-1 p-2 rounded-full bg-[#00a884] text-white shadow-lg hover:bg-[#008f6f] transition-transform hover:scale-105"
                title="Abrir foto em tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Clique na foto para abrir em tela cheia
            </p>

            {editing ? (
              <div className="w-full mt-3">
                <label className="text-[10px] text-slate-400 block text-left mb-1">Nome:</label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="bg-[#2a3942] border-[#374248] text-white text-center font-semibold text-base"
                  autoFocus
                />
              </div>
            ) : (
              <h3 className="text-lg font-semibold text-slate-100 mt-3 truncate max-w-full">
                {contact.name}
              </h3>
            )}

            {contact.online ? (
              <span className="mt-1 text-xs text-[#00a884] font-medium flex items-center">
                <span className="w-2 h-2 bg-[#00a884] rounded-full mr-1.5" />
                online
              </span>
            ) : (
              <span className="mt-1 text-xs text-slate-400">visto por último recentemente</span>
            )}
          </div>

          {/* Telefone */}
          <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider">
                Telefone
              </span>
              <Phone className="w-4 h-4 text-slate-400" />
            </div>

            {editing ? (
              <Input
                type="tel"
                value={draftPhone}
                onChange={(e) => setDraftPhone(e.target.value)}
                placeholder="+55 11 99999-8888"
                className="bg-[#2a3942] border-[#374248] text-white text-sm"
              />
            ) : (
              <p className="text-sm text-slate-200 font-mono">{contact.phone}</p>
            )}
          </div>

          {/* Recado / Status */}
          <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942] space-y-2">
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider">
              Recado
            </span>
            {editing ? (
              <Input
                value={draftAbout}
                onChange={(e) => setDraftAbout(e.target.value)}
                placeholder="Escreva um recado..."
                className="bg-[#2a3942] border-[#374248] text-white text-sm"
              />
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                {contact.about || 'Sem recado.'}
              </p>
            )}
          </div>

          {/* Estágio no CRM (Pipeline) */}
          <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider">
                Estágio no CRM
              </span>
              <Briefcase className="w-4 h-4 text-slate-400" />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {crmStageList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleMoveStage(s.id)}
                  className={`flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    s.id === stage
                      ? 'bg-[#2a3942] border-[#00a884] text-white shadow-sm'
                      : 'bg-[#202c33] border-[#222d34] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot} mr-1.5`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botão de Edição */}
          <div className="pt-2">
            {editing ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    setDraftName(contact.name)
                    setDraftPhone(contact.phone)
                    setDraftAbout(contact.about || '')
                  }}
                  className="flex-1 text-slate-300 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="flex-1 bg-[#00a884] hover:bg-[#008f6f] text-white"
                >
                  Salvar alterações
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="w-full bg-[#182229] border-[#2a3942] text-slate-200 hover:text-white hover:bg-[#202c33] space-x-2"
              >
                {savedFlash ? (
                  <Check className="w-4 h-4 text-[#00a884]" />
                ) : (
                  <Pencil className="w-4 h-4 text-slate-400" />
                )}
                <span>Editar nome, telefone e recado</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
