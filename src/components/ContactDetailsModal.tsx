import React, { useEffect, useState } from 'react'
import { FALLBACK_AVATAR } from '@/lib/evolution'
import {
  X,
  MessageCircle,
  Phone,
  Pencil,
  Check,
  Tag,
  Trash2,
  User,
  StickyNote,
  AlertTriangle,
  Ban,
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Contact, CrmStageId } from '@/types/whatsapp'
import { getStageLabelIn } from '@/data/crmData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { ContactNotesTab } from '@/components/ContactNotesTab'

interface ContactDetailsModalProps {
  contact: Contact | null
  onClose: () => void
  onOpenChat: (contactId: string) => void
  onFocusNote?: (noteId: string) => void
}

// Modal de detalhes do contato com CRUD completo (editar dados, excluir, gerenciar estágio/etiquetas)
// e navegação em abas para separar "Dados do Contato" e "Notas Internas"
export const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({
  contact,
  onClose,
  onOpenChat,
  onFocusNote,
}) => {
  const {
    crmStages,
    setContactStage,
    updateContact,
    deleteContact,
    crmStageList,
    labels,
    getContactLabelIds,
    toggleContactLabel,
    focusContactNote,
    getNotesByContact,
  } = useWhatsApp()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info')
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftAbout, setDraftAbout] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Fecha com a tecla Esc
  useEffect(() => {
    if (!contact) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contact, onClose])

  // Reinicia o estado ao trocar de contato
  useEffect(() => {
    setEditing(false)
    setConfirmDelete(false)
    setActiveTab('info')
    setDraftName(contact?.name || '')
    setDraftPhone(contact?.phone || '')
    setDraftAbout(contact?.about || '')
  }, [contact])

  if (!contact) return null

  const notesCount = getNotesByContact(contact.id).length
  // Estágio no CRM: se não estiver explicitamente definido, o contato está SEM estágio (fora do pipeline)
  const stage: CrmStageId | null = crmStages[contact.id] || null

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
        description: 'Informe um número de telefone para o contato.',
        variant: 'destructive',
      })
      return
    }
    updateContact(contact.id, draftName.trim(), draftAbout.trim(), draftPhone.trim())
    setEditing(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
    toast({ title: 'Contato atualizado', description: 'As informações foram salvas com sucesso.' })
  }

  const handleMoveStage = (next: CrmStageId | null) => {
    if (next === stage) return
    setContactStage(contact.id, next)
    if (!next) {
      toast({
        title: 'Removido do pipeline',
        description: `${contact.name} agora está sem estágio (fora do pipeline).`,
      })
    } else {
      toast({
        title: 'Negócio atualizado',
        description: `${contact.name} movido para "${getStageLabelIn(crmStageList, next)}".`,
      })
    }
  }

  const handleDeleteContact = () => {
    deleteContact(contact.id)
    toast({
      title: 'Contato excluído',
      description: `"${contact.name}" foi removido dos seus contatos.`,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#111b21] border border-[#2a3942] shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Dados de ${contact.name}`}
        aria-modal="true"
      >
        {/* Cabeçalho com foto */}
        <div className="relative bg-[#202c33] px-6 pt-5 pb-4 flex flex-col items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src={contact.avatar}
            alt={contact.name}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-white/15 shadow-md"
            onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = FALLBACK_AVATAR }}
          />
          {editing ? (
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Nome do contato"
              className="mt-3 w-full bg-[#2a3942] border-[#374248] text-white text-center font-semibold"
              autoFocus
            />
          ) : (
            <h3 className="mt-2.5 text-base sm:text-lg font-semibold text-white text-center truncate max-w-full">
              {contact.name}
            </h3>
          )}
          {contact.online && !editing && (
            <span className="mt-0.5 text-[11px] text-[#00a884] font-medium flex items-center">
              <span className="w-2 h-2 bg-[#00a884] rounded-full mr-1.5" />
              online
            </span>
          )}
        </div>

        {/* Abas: Dados do Contato | Notas Internas */}
        <div className="flex border-b border-[#222d34] bg-[#182229] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'info'
                ? 'border-[#00a884] text-[#00a884] bg-[#202c33]/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#202c33]/30'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dados do Contato</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'notes'
                ? 'border-[#00a884] text-[#00a884] bg-[#202c33]/50'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#202c33]/30'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Notas Internas</span>
            {notesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#00a884]/20 text-[#00a884] text-[10px] font-semibold">
                {notesCount}
              </span>
            )}
          </button>
        </div>

        {/* Corpo do Modal com Rolagem */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#111b21] space-y-4">
          {activeTab === 'info' ? (
            <>
              {/* Telefone */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-500 mb-1 font-medium">Número de telefone</p>
                  {editing ? (
                    <Input
                      type="tel"
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      placeholder="+55 11 99999-8888"
                      className="bg-[#2a3942] border-[#374248] text-white text-sm h-9"
                    />
                  ) : (
                    <p className="text-sm text-slate-100 font-mono">{contact.phone || 'Sem telefone'}</p>
                  )}
                </div>
                {!editing && <Phone className="w-4 h-4 text-slate-500 shrink-0" />}
              </div>

              {/* Recado / Sobre */}
              <div>
                <p className="text-[11px] text-slate-500 mb-1 font-medium">Recado / Status</p>
                {editing ? (
                  <Input
                    value={draftAbout}
                    onChange={(e) => setDraftAbout(e.target.value)}
                    placeholder="Escreva um recado..."
                    className="bg-[#2a3942] border-[#374248] text-white text-sm"
                  />
                ) : (
                  <p className="text-sm text-slate-200 bg-[#202c33] rounded-lg px-3 py-2 border border-[#222d34]">
                    {contact.about || 'Sem recado.'}
                  </p>
                )}
              </div>

              {/* Estágio no CRM (com estágio vazio / fora do pipeline) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-slate-500 font-medium">Estágio no CRM</p>
                  <span className="text-[10px] text-slate-500">
                    {stage ? 'Presente no pipeline' : 'Fora do pipeline'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* Opção Nenhum (fora do pipeline) */}
                  <button
                    type="button"
                    onClick={() => handleMoveStage(null)}
                    className={`flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      !stage
                        ? 'bg-[#2a3942] border-[#00a884] text-white shadow-xs'
                        : 'bg-[#202c33] border-[#222d34] text-slate-400 hover:text-slate-200 hover:border-[#374248]'
                    }`}
                    title="Remover do pipeline do CRM"
                  >
                    <Ban className="w-3 h-3 text-slate-400 mr-1.5" />
                    <span>Nenhum (fora do pipeline)</span>
                  </button>

                  {/* Estágios disponíveis */}
                  {crmStageList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleMoveStage(s.id)}
                      className={`flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        s.id === stage
                          ? 'bg-[#2a3942] border-[#00a884] text-white shadow-xs'
                          : 'bg-[#202c33] border-[#222d34] text-slate-400 hover:text-slate-200 hover:border-[#374248]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.dot} mr-1.5`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Etiquetas / Tags do Contato */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-slate-500 flex items-center font-medium">
                    <Tag className="w-3 h-3 mr-1 text-[#00a884]" />
                    Etiquetas
                  </p>
                  <span className="text-[10px] text-slate-500">Clique para alternar</span>
                </div>
                {labels.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nenhuma etiqueta cadastrada.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const contactLabelIds = getContactLabelIds(contact.id)
                      return labels.map((lbl) => {
                        const isAttached = contactLabelIds.includes(lbl.id)
                        return (
                          <button
                            key={lbl.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleContactLabel(contact.id, lbl.id)
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                              isAttached
                                ? 'text-white shadow-xs border-white/40 wa-tag-badge'
                                : 'bg-[#202c33] border-[#2a3942] text-slate-400 hover:text-white hover:border-[#374248]'
                            }`}
                            style={
                              isAttached
                                ? { backgroundColor: lbl.color, borderColor: lbl.color }
                                : undefined
                            }
                            title={isAttached ? 'Remover etiqueta' : 'Adicionar etiqueta'}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: isAttached ? '#ffffff' : lbl.color }}
                            />
                            <span>{lbl.name}</span>
                            {isAttached && <Check className="w-3 h-3 text-white ml-0.5" />}
                          </button>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Tab de Notas Internas */
            <div className="space-y-3">
              <ContactNotesTab
                key={contact.id}
                contactId={contact.id}
                contactName={contact.name}
                onFocusNote={(noteId) => {
                  if (onFocusNote) onFocusNote(noteId)
                  else {
                    onOpenChat(contact.id)
                    focusContactNote(noteId)
                    onClose()
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Rodapé com Ações CRUD */}
        <div className="p-4 bg-[#111b21] border-t border-[#222d34] flex flex-col gap-2 shrink-0">
          {confirmDelete ? (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 space-y-2 animate-fade-in">
              <div className="flex items-center space-x-2 text-rose-300 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Excluir contato permanentemente?</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Esta ação removerá "{contact.name}" dos contatos salvos e do pipeline.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-slate-300 hover:text-white h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={handleDeleteContact}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-8 text-xs font-medium"
                >
                  Excluir contato
                </Button>
              </div>
            </div>
          ) : editing ? (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
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
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={() => onOpenChat(contact.id)}
                className="flex-1 bg-[#00a884] hover:bg-[#008f6f] text-white space-x-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Abrir conversa</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveTab('info')
                  setEditing(true)
                }}
                className="text-slate-300 hover:text-white"
                title="Editar dados do contato"
              >
                {savedFlash ? (
                  <Check className="w-4 h-4 text-[#00a884]" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
                <span className="ml-1.5">Editar</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                title="Excluir contato"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
