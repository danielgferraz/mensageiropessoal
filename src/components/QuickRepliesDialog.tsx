import React, { useState } from 'react'
import { Plus, Zap, Trash2, Edit2, X, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { QuickReply } from '@/types/whatsapp'
import { useToast } from '@/hooks/use-toast'

interface QuickRepliesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectReply: (text: string) => void
}

export const QuickRepliesDialog: React.FC<QuickRepliesDialogProps> = ({
  open,
  onOpenChange,
  onSelectReply,
}) => {
  const { quickReplies, createQuickReply, updateQuickReply, deleteQuickReply } = useWhatsApp()
  const { toast } = useToast()

  const [isCreating, setIsCreating] = useState(false)
  const [newText, setNewText] = useState('')
  const [newShortcut, setNewShortcut] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editShortcut, setEditShortcut] = useState('')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newText.trim()) return

    createQuickReply(newText.trim(), newShortcut.trim())
    setNewText('')
    setNewShortcut('')
    setIsCreating(false)
    toast({
      title: 'Resposta rápida salva',
      description: 'Agora você pode usá-la em qualquer conversa.',
    })
  }

  const startEdit = (qr: QuickReply, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(qr.id)
    setEditText(qr.text)
    setEditShortcut(qr.shortcut || '')
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !editText.trim()) return

    updateQuickReply(editingId, editText.trim(), editShortcut.trim())
    setEditingId(null)
    toast({
      title: 'Resposta rápida atualizada',
    })
  }

  const handleDelete = (qr: QuickReply, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteQuickReply(qr.id)
    toast({
      title: 'Resposta rápida removida',
    })
  }

  const handleChoose = (text: string) => {
    onSelectReply(text)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 max-w-lg w-full p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-[#00a884]">
            <Zap className="w-5 h-5 shrink-0" />
            <DialogTitle className="text-lg font-semibold text-white">
              Respostas Rápidas
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Envie mensagens frequentes com apenas um clique ou crie novas respostas.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de respostas rápidas */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 my-2 divide-y divide-[#2a3942]/60">
          {quickReplies.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Nenhuma resposta rápida cadastrada ainda.
            </div>
          ) : (
            quickReplies.map((qr) => {
              if (editingId === qr.id) {
                return (
                  <form
                    key={qr.id}
                    onSubmit={handleSaveEdit}
                    className="py-3 space-y-2 animate-fade-in"
                  >
                    <Input
                      placeholder="Atalho (opcional, ex: /ola)"
                      value={editShortcut}
                      onChange={(e) => setEditShortcut(e.target.value)}
                      className="bg-[#2a3942] border-[#374248] text-white text-xs h-8"
                    />
                    <Textarea
                      placeholder="Texto da resposta..."
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="bg-[#2a3942] border-[#374248] text-white text-xs min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-white h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-[#00a884] hover:bg-[#008f6f] text-white h-8 text-xs"
                      >
                        Salvar
                      </Button>
                    </div>
                  </form>
                )
              }

              return (
                <div
                  key={qr.id}
                  onClick={() => handleChoose(qr.text)}
                  className="flex items-start justify-between py-2.5 px-2.5 rounded-lg hover:bg-[#2a3942]/50 cursor-pointer transition-colors group"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    {qr.shortcut && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#00a884]/20 text-[#00a884] mb-1">
                        {qr.shortcut}
                      </span>
                    )}
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                      {qr.text}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleChoose(qr.text)
                      }}
                      className="bg-[#00a884] hover:bg-[#008f6f] text-white h-7 px-2.5 text-xs opacity-90 group-hover:opacity-100"
                      title="Enviar esta resposta"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Enviar
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => startEdit(qr, e)}
                      className="w-7 h-7 text-slate-400 hover:text-white hover:bg-[#374248]"
                      title="Editar resposta rápida"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(qr, e)}
                      className="w-7 h-7 text-slate-400 hover:text-red-400 hover:bg-[#374248]"
                      title="Excluir resposta rápida"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Formulário de criação */}
        {isCreating ? (
          <form
            onSubmit={handleCreate}
            className="p-3 bg-[#182229] rounded-lg border border-[#2a3942] space-y-2.5 animate-fade-in"
          >
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span>Nova Resposta Rápida</span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <Input
              placeholder="Atalho opcional (ex.: /preco, /ola)"
              value={newShortcut}
              onChange={(e) => setNewShortcut(e.target.value)}
              className="bg-[#202c33] border-[#2a3942] text-white text-xs h-8"
            />

            <Textarea
              placeholder="Digite o texto completo da mensagem frequente..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="bg-[#202c33] border-[#2a3942] text-white text-xs min-h-[70px]"
              autoFocus
            />

            <div className="flex justify-end space-x-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs"
              >
                Salvar Resposta
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCreating(true)}
            className="w-full border-dashed border-[#2a3942] bg-transparent text-[#00a884] hover:bg-[#2a3942]/40 hover:text-[#00a884] text-xs h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar Nova Resposta
          </Button>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-[#2a3942] hover:bg-[#374248] text-white text-xs px-4"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
