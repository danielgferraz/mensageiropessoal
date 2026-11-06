import React, { useEffect, useState } from 'react'
import { X, MessageCircle, Phone, Pencil, Check, Tag } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Contact, CrmStageId } from '@/types/whatsapp'
import { findStage, getStageLabelIn } from '@/data/crmData'
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

// Modal de detalhes do contato: foto, dados, nota e estágio no CRM,
// com ações rápidas (conversa, mover estágio, editar informações básicas)
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
    crmStageList,
    labels,
    getContactLabelIds,
    toggleContactLabel,
    focusContactNote,
  } = useWhatsApp()
  const { toast } = useToast()

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftAbout, setDraftAbout] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  // Fecha com a tecla Esc
  useEffect(() => {
    if (!contact) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contact, onClose])

  // Reinicia o estado de edição sempre que abre para outro contato
  useEffect(() => {
    setEditing(false)
    setDraftName(contact?.name || '')
    setDraftPhone(contact?.phone || '')
    setDraftAbout(contact?.about || '')
  }, [contact])

  if (!contact) return null

  const stage: CrmStageId = crmStages[contact.id] || crmStageList[0]?.id || 'novo'
  const stageConfig = findStage(crmStageList, stage)

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

  const handleMoveStage = (next: CrmStageId) => {
    if (next === stage) return
    setContactStage(contact.id, next)
    toast({
      title: 'Negócio atualizado',
      description: `${contact.name} movido para "${getStageLabelIn(crmStageList, next)}".`,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#111b21] border border-[#2a3942] shadow-2xl overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Dados de ${contact.name}`}
        aria-modal="true"
      >
        {/* Cabeçalho com foto grande */}
        <div className="relative bg-[#202c33] px-6 pt-6 pb-5 flex flex-col items-center">
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
            className="w-24 h-24 rounded-full object-cover ring-2 ring-white/15"
          />
          {editing ? (
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="mt-3 w-full bg-[#2a3942] border-[#374248] text-white text-center font-semibold"
              autoFocus
            />
          ) : (
            <h3 className="mt-3 text-lg font-semibold text-white text-center truncate max-w-full">
              {contact.name}
            </h3>
          )}
          {contact.online && !editing && (
            <span className="mt-1 text-[11px] text-[#00a884] font-medium flex items-center">
              <span className="w-2 h-2 bg-[#00a884] rounded-full mr-1.5" />
              online
            </span>
          )}
        </div>

        {/* Informações */}
        <div className="px-5 py-4 space-y-4 bg-[#111b21]">
          {/* Número */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-500 mb-1">Número de telefone</p>
              {editing ? (
                <Input
                  type="tel"
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  placeholder="+55 11 99999-8888"
                  className="bg-[#2a3942] border-[#374248] text-white text-sm h-9"
                />
              ) : (
                <p className="text-sm text-slate-100 truncate">{contact.phone}</p>
              )}
            </div>
            {!editing && <Phone className="w-4 h-4 text-slate-500 shrink-0" />}
          </div>

          {/* Recado / nota */}
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Recado / nota</p>
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

          {/* Estágio no CRM */}
          <div>
            <p className="text-[11px] text-slate-500 mb-1.5">Estágio no CRM</p>
            <div className="flex flex-wrap gap-1.5">
              {crmStageList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleMoveStage(s.id)}
                  className={`flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    s.id === stage
                      ? 'bg-[#2a3942] border-[#00a884] text-white'
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
              <p className="text-[11px] text-slate-500 flex items-center">
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
                            ? 'text-white shadow-sm border-white/40 wa-tag-badge'
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
        </div>

        <section className="px-5 pb-5 space-y-3" aria-labelledby="contact-modal-notes-title">
          <h4 id="contact-modal-notes-title" className="text-sm font-semibold text-amber-200">Notas internas</h4>
          <ContactNotesTab key={contact.id} contactId={contact.id} contactName={contact.name} onFocusNote={(noteId) => {
            if (onFocusNote) onFocusNote(noteId)
            else { onOpenChat(contact.id); focusContactNote(noteId); onClose() }
          }} />
        </section>

        {/* Ações */}
        <div className="px-5 pb-5 pt-1 flex items-center space-x-2 bg-[#111b21]">
          {editing ? (
            <>
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
                Salvar
              </Button>
            </>
          ) : (
            <>
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
                onClick={() => setEditing(true)}
                className="text-slate-300 hover:text-white"
                title="Editar informações"
              >
                {savedFlash ? (
                  <Check className="w-4 h-4 text-[#00a884]" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
                <span className="ml-1.5">Editar</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
