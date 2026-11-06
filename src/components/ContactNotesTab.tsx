import React, { useEffect, useId, useState } from 'react'
import { FileText, Plus, Pencil, Trash2, Clock, X, ArrowUpRight } from 'lucide-react'
import { ContactNote } from '@/types/whatsapp'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { formatNoteDate } from '@/lib/contact-notes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
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
  onFocusNote?: (noteId: string) => void
}

export const ContactNotesTab: React.FC<ContactNotesTabProps> = ({ contactId, contactName, onFocusNote }) => {
  const { noteStorageError, getNotesByContact, addContactNote, updateContactNote, deleteContactNote } = useWhatsApp()
  const { toast } = useToast()
  const notes = getNotesByContact(contactId)
  const fieldId = useId()
  const [isCreating, setIsCreating] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deletingNote, setDeletingNote] = useState<ContactNote | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsCreating(false)
    setNewNoteText('')
    setEditingNoteId(null)
    setEditText('')
    setDeletingNote(null)
    setError(null)
  }, [contactId])

  const reportError = (failure: unknown) => {
    const message = failure instanceof Error ? failure.message : 'Não foi possível salvar a alteração. Tente novamente.'
    setError(message)
    toast({ title: 'Alteração não salva', description: message, variant: 'destructive' })
  }

  const handleCreateNote = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      if (!newNoteText.trim()) throw new Error('Digite o conteúdo da nota antes de salvar.')
      const created = addContactNote(contactId, newNoteText)
      if (!created) throw new Error('Não foi possível criar a nota. O rascunho foi preservado.')
      setNewNoteText('')
      setIsCreating(false)
      toast({ title: 'Nota interna salva', description: 'A nota não foi enviada ao WhatsApp.' })
    } catch (failure) { reportError(failure) }
  }

  const handleSaveEdit = (event: React.FormEvent, noteId: string) => {
    event.preventDefault()
    setError(null)
    try {
      if (!editText.trim()) throw new Error('A nota não pode ficar vazia.')
      updateContactNote(noteId, editText)
      setEditingNoteId(null)
      setEditText('')
      toast({ title: 'Nota interna atualizada' })
    } catch (failure) { reportError(failure) }
  }

  const handleConfirmDelete = () => {
    if (!deletingNote) return
    setError(null)
    try {
      deleteContactNote(deletingNote.id)
      setDeletingNote(null)
      toast({ title: 'Nota interna excluída' })
    } catch (failure) { reportError(failure) }
  }

  return (
    <section className="space-y-4" aria-label={`Notas internas de ${contactName}`}>
      <p id={`${fieldId}-privacy`} className="text-xs leading-relaxed text-amber-200/90">
        Notas internas ficam apenas neste navegador e não são enviadas ao contato pelo WhatsApp.
      </p>
      {noteStorageError && <p role="alert" className="text-sm text-red-300">{noteStorageError}</p>}
      {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-red-300">{error}</p>}
      {!isCreating && (
        <Button type="button" onClick={() => { setIsCreating(true); setError(null) }}
          className="w-full min-h-11 bg-amber-400 hover:bg-amber-300 text-slate-950 gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />Nova nota interna
        </Button>
      )}
      {isCreating && (
        <form onSubmit={handleCreateNote} className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${fieldId}-new`} className="text-sm font-semibold text-amber-200">Nova nota interna</label>
            <Button type="button" variant="ghost" size="icon" aria-label="Cancelar nova nota" className="min-h-11 min-w-11"
              onClick={() => { setIsCreating(false); setNewNoteText(''); setError(null) }}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Textarea id={`${fieldId}-new`} value={newNoteText} onChange={(event) => setNewNoteText(event.target.value)}
            maxLength={10000} required autoFocus aria-invalid={!!error}
            aria-describedby={`${fieldId}-privacy${error ? ` ${fieldId}-error` : ''}`}
            placeholder={`Observação interna sobre ${contactName}`}
            className="min-h-[110px] resize-y bg-[#2a3942] border-[#374248] text-white focus-visible:ring-amber-400" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" className="min-h-11 text-slate-200"
              onClick={() => { setIsCreating(false); setNewNoteText(''); setError(null) }}>Cancelar</Button>
            <Button type="submit" className="min-h-11 bg-amber-400 hover:bg-amber-300 text-slate-950">Salvar nota interna</Button>
          </div>
        </form>
      )}
      {!notes.length && !isCreating && (
        <div className="py-8 text-center text-slate-400">
          <FileText className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma nota interna para este contato.</p>
        </div>
      )}
      <div className="space-y-3">
        {notes.map((note) => (
          <article key={note.id} className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-xs text-slate-300 space-y-1">
                <p className="font-medium text-amber-200 break-words">{note.authorName || 'Autor não registrado'}</p>
                <p className="flex items-start gap-1"><Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{formatNoteDate(note.createdAt)}</span>
                </p>
                {note.updatedAt && <p className="text-slate-400">Editada em {formatNoteDate(note.updatedAt)}</p>}
              </div>
              {editingNoteId !== note.id && (
                <div className="flex shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-slate-300"
                    title="Editar nota" aria-label={`Editar nota de ${note.authorName || 'autor não registrado'}`}
                    onClick={() => { setEditingNoteId(note.id); setEditText(note.text); setError(null) }}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-red-300"
                    title="Excluir nota" aria-label={`Excluir nota de ${note.authorName || 'autor não registrado'}`}
                    onClick={() => { setDeletingNote(note); setError(null) }}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
            {editingNoteId === note.id ? (
              <form onSubmit={(event) => handleSaveEdit(event, note.id)} className="space-y-2">
                <label htmlFor={`${fieldId}-edit`} className="text-xs text-amber-200">Editar nota interna</label>
                <Textarea id={`${fieldId}-edit`} value={editText} onChange={(event) => setEditText(event.target.value)}
                  maxLength={10000} required autoFocus aria-invalid={!!error}
                  aria-describedby={error ? `${fieldId}-error` : `${fieldId}-privacy`}
                  className="min-h-[110px] resize-y bg-[#2a3942] border-[#374248] text-white focus-visible:ring-amber-400" />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" className="min-h-11 text-slate-200"
                    onClick={() => { setEditingNoteId(null); setEditText(''); setError(null) }}>Cancelar</Button>
                  <Button type="submit" className="min-h-11 bg-amber-400 hover:bg-amber-300 text-slate-950">Salvar alterações da nota</Button>
                </div>
              </form>
            ) : onFocusNote ? (
              <button type="button" onClick={() => onFocusNote(note.id)}
                className="block w-full min-h-11 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
                <span className="block whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed">{note.text}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-200"><ArrowUpRight className="h-4 w-4" aria-hidden="true" />Ver no chat</span>
              </button>
            ) : <p className="whitespace-pre-wrap break-words text-sm text-slate-100 leading-relaxed">{note.text}</p>}
          </article>
        ))}
      </div>
      <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota interna?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">A nota será removida deste navegador. Mensagens do WhatsApp não serão alteradas.</AlertDialogDescription>
          </AlertDialogHeader>
          {deletingNote && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-[#182229] p-3 text-sm text-slate-300">{deletingNote.text}</p>}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="min-h-11 bg-transparent border-[#374248] text-slate-200">Cancelar</AlertDialogCancel>
            <Button type="button" onClick={handleConfirmDelete} className="min-h-11 bg-red-600 hover:bg-red-700 text-white">Excluir nota interna</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
