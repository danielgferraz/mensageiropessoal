import React, { useState } from 'react'
import { Plus, Tag, Trash2, Check, X, Palette, Edit2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { LABEL_COLORS } from '@/data/labelsData'
import { ConversationLabel } from '@/types/whatsapp'
import { useToast } from '@/hooks/use-toast'

interface LabelsManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Se informado, permite atribuir/desmarcar etiquetas a essa conversa específica
  targetConversationId?: string | null
}

export const LabelsManagerDialog: React.FC<LabelsManagerDialogProps> = ({
  open,
  onOpenChange,
  targetConversationId,
}) => {
  const { labels, conversations, createLabel, updateLabel, deleteLabel, toggleConversationLabel } =
    useWhatsApp()
  const { toast } = useToast()

  const [isCreating, setIsCreating] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0].bg)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(LABEL_COLORS[0].bg)

  const targetConv = targetConversationId
    ? conversations.find((c) => c.id === targetConversationId)
    : null

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabelName.trim()) return

    const created = createLabel(newLabelName.trim(), selectedColor)
    if (created && targetConversationId) {
      // Se estava atribuindo a uma conversa, já marca a nova
      toggleConversationLabel(targetConversationId, created.id)
    }

    setNewLabelName('')
    setIsCreating(false)
    toast({
      title: 'Etiqueta criada',
      description: `Etiqueta "${created?.name}" adicionada com sucesso.`,
    })
  }

  const startEdit = (lbl: ConversationLabel) => {
    setEditingId(lbl.id)
    setEditName(lbl.name)
    setEditColor(lbl.color)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !editName.trim()) return
    updateLabel(editingId, editName.trim(), editColor)
    setEditingId(null)
    toast({
      title: 'Etiqueta atualizada',
    })
  }

  const handleDelete = (lbl: ConversationLabel) => {
    deleteLabel(lbl.id)
    toast({
      title: 'Etiqueta removida',
      description: `A etiqueta "${lbl.name}" foi excluída.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 max-w-md w-full p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-[#00a884]">
            <Tag className="w-5 h-5 shrink-0" />
            <DialogTitle className="text-lg font-semibold text-white">
              {targetConv ? `Etiquetas: ${targetConv.name}` : 'Gerenciar Etiquetas'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            {targetConv
              ? 'Marque as etiquetas para aplicar a esta conversa ou crie novas.'
              : 'Crie, edite ou exclua etiquetas coloridas para organizar suas conversas.'}
          </DialogDescription>
        </DialogHeader>

        {/* Lista de etiquetas existentes */}
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 my-2 divide-y divide-[#2a3942]/60">
          {labels.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Nenhuma etiqueta criada ainda.
            </div>
          ) : (
            labels.map((lbl) => {
              const isAssigned = targetConv && (targetConv.labelIds || []).includes(lbl.id)

              if (editingId === lbl.id) {
                return (
                  <form
                    key={lbl.id}
                    onSubmit={handleSaveEdit}
                    className="py-2.5 space-y-2 animate-fade-in"
                  >
                    <div className="flex items-center space-x-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-[#2a3942] border-[#374248] text-white text-xs h-8"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-[#00a884] hover:bg-[#008f6f] text-white h-8 text-xs"
                      >
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-white h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>

                    <div className="flex items-center space-x-1.5 pt-1">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditColor(c.bg)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            editColor === c.bg
                              ? 'ring-2 ring-white scale-110'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.bg }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </form>
                )
              }

              return (
                <div
                  key={lbl.id}
                  className="flex items-center justify-between py-2 group hover:bg-[#2a3942]/40 px-2 rounded-md transition-colors"
                >
                  <div
                    className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      if (targetConversationId) {
                        toggleConversationLabel(targetConversationId, lbl.id)
                      }
                    }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: lbl.color }}
                    />
                    <span className="text-sm text-slate-200 font-medium truncate">{lbl.name}</span>

                    {/* Contagem de conversas nesta etiqueta */}
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ({conversations.filter((c) => (c.labelIds || []).includes(lbl.id)).length})
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {targetConversationId && (
                      <button
                        type="button"
                        onClick={() => toggleConversationLabel(targetConversationId, lbl.id)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          isAssigned
                            ? 'bg-[#00a884] text-white'
                            : 'border border-slate-500 text-transparent hover:border-slate-300'
                        }`}
                        title={isAssigned ? 'Remover etiqueta' : 'Atribuir etiqueta'}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(lbl)}
                      className="w-7 h-7 text-slate-400 hover:text-white hover:bg-[#374248]"
                      title="Editar etiqueta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(lbl)}
                      className="w-7 h-7 text-slate-400 hover:text-red-400 hover:bg-[#374248]"
                      title="Excluir etiqueta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Formulário para criar nova etiqueta */}
        {isCreating ? (
          <form
            onSubmit={handleCreate}
            className="p-3 bg-[#182229] rounded-lg border border-[#2a3942] space-y-3 animate-fade-in"
          >
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span>Nova Etiqueta</span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <Input
              placeholder="Nome da etiqueta (ex.: Fornecedor, VIP...)"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              className="bg-[#202c33] border-[#2a3942] text-white text-xs h-9"
              autoFocus
            />

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                <Palette className="w-3 h-3" /> Cor da etiqueta:
              </p>
              <div className="flex items-center space-x-2">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedColor(c.bg)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      selectedColor === c.bg
                        ? 'ring-2 ring-white scale-110'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.bg }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

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
                Criar Etiqueta
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
            Nova Etiqueta
          </Button>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs px-4"
          >
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
