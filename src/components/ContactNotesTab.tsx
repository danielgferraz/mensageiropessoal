import React, { useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Clock, Check, X, AlertTriangle } from 'lucide-react'
import { ContactNote } from '@/types/whatsapp'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface ContactNotesTabProps {
  contactId: string
  contactName: string
}

export const ContactNotesTab: React.FC<ContactNotesTabProps> = ({ contactId, contactName }) => {
  const { getNotesByContact, addContactNote, updateContactNote, deleteContactNote } = useWhatsApp()
  const { toast } = useToast()

  const notes = getNotesByContact(contactId)

  // Estado para criação
  const [isCreating, setIsCreating] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')

  // Estado para edição
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Estado para exclusão (confirmação)
  const [deletingNote, setDeletingNote] = useState<ContactNote | null>(null)

  const handleCreateNote = () => {
    if (!newNoteText.trim()) {
      toast({
        title: 'Texto obrigatório',
        description: 'Digite o conteúdo da nota antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    const created = addContactNote(contactId, newNoteText.trim())
    if (created) {
      setNewNoteText('')
      setIsCreating(false)
      toast({
        title: 'Nota salva',
        description: 'A anotação interna foi registrada com sucesso.',
      })
    }
  }

  const handleStartEdit = (note: ContactNote) => {
    setEditingNoteId(note.id)
    setEditText(note.text)
  }

  const handleSaveEdit = (noteId: string) => {
    if (!editText.trim()) {
      toast({
        title: 'Texto obrigatório',
        description: 'A nota não pode ficar vazia.',
        variant: 'destructive',
      })
      return
    }
    updateContactNote(noteId, editText.trim())
    setEditingNoteId(null)
    setEditText('')
    toast({
      title: 'Nota atualizada',
      description: 'Alterações na nota foram salvas.',
    })
  }

  const handleConfirmDelete = () => {
    if (!deletingNote) return
    deleteContactNote(deletingNote.id)
    setDeletingNote(null)
    toast({
      title: 'Nota excluída',
      description: 'A anotação foi removida do contato.',
    })
  }

  return (
    <div className="space-y-4">
      {/* Botão para criar nova nota se não estiver no formulário */}
      {!isCreating && (
        <Button
          type="button"
          onClick={() => {
            setIsCreating(true)
            setNewNoteText('')
          }}
          className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white space-x-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nova nota interna</span>
        </Button>
      )}

      {/* Formulário de criação de nota */}
      {isCreating && (
        <div className="bg-[#182229] p-3.5 rounded-xl border border-[#00a884]/40 space-y-3 animate-fade-in shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1" />
              Adicionar nota interna
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false)
                setNewNoteText('')
              }}
              className="text-slate-400 hover:text-white"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder={`Escreva uma anotação privada sobre ${contactName}... (ex: preferências, histórico, pendências)`}
            className="bg-[#2a3942] border-[#374248] text-white text-xs min-h-[90px] focus-visible:ring-[#00a884] resize-none"
            autoFocus
          />

          <div className="flex items-center justify-end space-x-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false)
                setNewNoteText('')
              }}
              className="text-slate-300 hover:text-white text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateNote}
              className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs h-8 px-3"
            >
              Salvar nota
            </Button>
          </div>
        </div>
      )}

      {/* Lista de notas */}
      <div className="space-y-3">
        {notes.length === 0 && !isCreating ? (
          <div className="bg-[#182229] p-6 rounded-xl border border-[#2a3942] text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">Nenhuma nota interna</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[240px] mx-auto">
              Adicione lembretes, observações e dados importantes visíveis apenas para você sobre{' '}
              {contactName}.
            </p>
          </div>
        ) : (
          notes.map((note) => {
            const isEditingThis = editingNoteId === note.id

            return (
              <div
                key={note.id}
                className="bg-[#182229] p-3.5 rounded-xl border border-[#2a3942] space-y-2.5 transition-colors hover:border-[#374248]"
              >
                {/* Header da nota com data e ações */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center truncate">
                    <Clock className="w-3 h-3 mr-1 shrink-0 text-slate-400" />
                    <span className="truncate">{note.createdAt}</span>
                    {note.updatedAt && (
                      <span className="ml-1 text-[10px] text-slate-400 truncate">
                        (editada em {note.updatedAt})
                      </span>
                    )}
                  </span>

                  {!isEditingThis && (
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(note)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#2a3942] transition-colors"
                        title="Editar nota"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingNote(note)}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-[#2a3942] transition-colors"
                        title="Excluir nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Conteúdo da nota ou formulário de edição */}
                {isEditingThis ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="bg-[#2a3942] border-[#374248] text-white text-xs min-h-[80px] focus-visible:ring-[#00a884] resize-none"
                      autoFocus
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNoteId(null)
                          setEditText('')
                        }}
                        className="text-slate-300 hover:text-white text-xs h-7 px-2.5"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(note.id)}
                        className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs h-7 px-3 space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                    {note.text}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Diálogo de confirmação para exclusão de nota */}
      <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center space-x-2 text-red-400 mb-1">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <AlertDialogTitle className="text-base text-slate-100">
                Excluir nota interna?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed">
              Esta anotação será excluída permanentemente deste contato. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deletingNote && (
            <div className="p-2.5 bg-[#182229] border border-[#2a3942] rounded-lg text-xs text-slate-300 line-clamp-3 italic">
              &quot;{deletingNote.text}&quot;
            </div>
          )}

          <AlertDialogFooter className="space-x-2 pt-2">
            <AlertDialogCancel
              onClick={() => setDeletingNote(null)}
              className="bg-transparent border-[#374248] text-slate-300 hover:bg-[#2a3942] hover:text-white text-xs"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Excluir nota
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
