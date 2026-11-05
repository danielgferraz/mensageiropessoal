import React, { useState } from 'react'
import { CRM_STAGE_COLORS, CrmStageConfig } from '@/data/crmData'
import { CrmStageId } from '@/types/whatsapp'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export type StageDialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'rename'; stageId: CrmStageId }
  | { kind: 'delete'; stageId: CrmStageId }

interface StageDialogsProps {
  dialog: StageDialogState
  onClose: () => void
  stageList: CrmStageConfig[]
  addCrmStage: (label: string, colorIndex?: number) => CrmStageConfig | null
  renameCrmStage: (stageId: CrmStageId, label: string) => void
  deleteCrmStage: (stageId: CrmStageId, moveContactsTo: CrmStageId) => void
}

// Modais de CRUD de estágios: criar/renomear (Dialog) e excluir (AlertDialog com destino)
export const StageDialogs: React.FC<StageDialogsProps> = ({
  dialog,
  onClose,
  stageList,
  addCrmStage,
  renameCrmStage,
  deleteCrmStage,
}) => {
  const { toast } = useToast()
  const [stageName, setStageName] = useState('')
  const [stageColor, setStageColor] = useState(0)

  // O estágio a excluir vem do estado do diálogo (aberto pelo menu "Estágios")
  const deleteTarget = dialog.kind === 'delete' ? dialog.stageId : null
  const currentIndex = deleteTarget ? stageList.findIndex((s) => s.id === deleteTarget) : -1
  // Sugestão: mover para o estágio anterior (o seguinte, quando for o primeiro)
  const suggested =
    currentIndex > 0
      ? stageList[currentIndex - 1]
      : currentIndex === 0 && stageList.length > 1
        ? stageList[1]
        : undefined
  const [deleteMoveTo, setDeleteMoveTo] = useState<CrmStageId | null>(null)

  React.useEffect(() => {
    if (deleteTarget) setDeleteMoveTo(suggested ? suggested.id : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTarget])

  const handleCreate = () => {
    const created = addCrmStage(stageName, stageColor)
    if (!created) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o novo estágio.',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: 'Estágio criado',
      description: `"${created.label}" foi adicionado ao fim do pipeline.`,
    })
    onClose()
  }

  const handleRename = () => {
    if (dialog.kind !== 'rename') return
    if (!stageName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O estágio precisa ter pelo menos um nome.',
        variant: 'destructive',
      })
      return
    }
    renameCrmStage(dialog.stageId, stageName)
    toast({ title: 'Estágio renomeado', description: `Agora chama "${stageName.trim()}".` })
    onClose()
  }

  const handleDelete = () => {
    if (!deleteTarget || !deleteMoveTo) return
    const target = stageList.find((s) => s.id === deleteTarget)
    const destination = stageList.find((s) => s.id === deleteMoveTo)
    if (!target || !destination) return

    deleteCrmStage(deleteTarget, deleteMoveTo)
    toast({
      title: 'Estágio excluído',
      description: `"${target.label}" removido. Os contatos foram movidos para "${destination.label}".`,
    })
    onClose()
  }

  return (
    <>
      {/* Modal criar/renomear estágio */}
      <Dialog
        open={dialog.kind === 'create' || dialog.kind === 'rename'}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="bg-[#222e35] border-[#2f3b43] text-slate-100 w-[94vw] max-w-sm rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {dialog.kind === 'create' ? 'Novo estágio' : 'Renomear estágio'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Nome do estágio</label>
              <Input
                placeholder="Ex: Proposta enviada"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (dialog.kind === 'create') {
                      handleCreate()
                    } else {
                      handleRename()
                    }
                  }
                }}
                className="bg-[#2a3942] border-[#374248] text-white"
                autoFocus
              />
            </div>

            {dialog.kind === 'create' && (
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Cor do marcador</label>
                <div className="flex items-center flex-wrap gap-2">
                  {CRM_STAGE_COLORS.map((color, index) => (
                    <button
                      key={color.dot}
                      type="button"
                      title={color.label}
                      onClick={() => setStageColor(index)}
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center transition-transform',
                        stageColor === index ? 'ring-2 ring-white/70 scale-110' : 'opacity-80',
                      )}
                    >
                      <span className={cn('w-4 h-4 rounded-full', color.dot)} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => (dialog.kind === 'create' ? handleCreate() : handleRename())}
              className="bg-[#00a884] hover:bg-[#008f6f] text-white"
            >
              {dialog.kind === 'create' ? 'Criar estágio' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão do estágio, com destino dos contatos */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <AlertDialogContent className="bg-[#222e35] border-[#2f3b43] text-slate-100 w-[94vw] max-w-md rounded-2xl p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-slate-100">
              Excluir estágio?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              O estágio "{stageList.find((s) => s.id === deleteTarget)?.label}" será removido do
              pipeline. Escolha para onde vão os contatos dele:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-[#2f3b43] divide-y divide-[#2a3942]">
            {stageList
              .filter((s) => s.id !== deleteTarget)
              .map((s) => (
                <label
                  key={s.id}
                  className="flex items-center px-3 py-2.5 cursor-pointer hover:bg-[#182229]"
                >
                  <input
                    type="radio"
                    name="delete-stage-target"
                    checked={deleteMoveTo === s.id}
                    onChange={() => setDeleteMoveTo(s.id)}
                    className="accent-[#00a884] mr-2.5"
                  />
                  <span className={cn('w-2 h-2 rounded-full mr-2', s.dot)} />
                  <span className="text-sm text-slate-200">{s.label}</span>
                  {s.id === suggested?.id && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-[#00a884] font-semibold shrink-0">
                      sugerido
                    </span>
                  )}
                </label>
              ))}
          </div>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2 pt-2">
            <AlertDialogCancel className="bg-transparent border-[#2a3942] text-slate-300 hover:text-white hover:bg-[#202c33] h-10 w-full sm:w-auto mt-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!deleteMoveTo}
              className="bg-red-600 hover:bg-red-700 text-white h-10 w-full sm:w-auto font-medium"
            >
              Excluir e mover negócios
            </AlertDialogAction>
          </AlertDialogFooter>{' '}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
