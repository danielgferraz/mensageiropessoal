import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserPlus } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { useToast } from '@/hooks/use-toast'
import { Contact, CrmStageId } from '@/types/whatsapp'

interface NewContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactCreated?: (contact: Contact) => void
}

export const NewContactDialog: React.FC<NewContactDialogProps> = ({
  open,
  onOpenChange,
  onContactCreated,
}) => {
  const { addContact, crmStageList, setContactStage } = useWhatsApp()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [about, setAbout] = useState('')
  const [stageId, setStageId] = useState<CrmStageId>('novo')

  const resetForm = () => {
    setName('')
    setPhone('')
    setAbout('')
    setStageId(crmStageList[0]?.id || 'novo')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite o nome do contato.',
        variant: 'destructive',
      })
      return
    }
    if (!phone.trim()) {
      toast({
        title: 'Telefone obrigatório',
        description: 'Digite o número do telefone.',
        variant: 'destructive',
      })
      return
    }

    let created: Contact
    try {
      created = addContact(name.trim(), phone.trim(), about.trim() || undefined)
    } catch (error) {
      toast({ title: 'Telefone inválido', description: error instanceof Error ? error.message : 'Confira o número.', variant: 'destructive' })
      return
    }
    if (stageId) {
      setContactStage(created.id, stageId)
    }

    toast({
      title: 'Contato criado!',
      description: `${created.name} (${created.phone}) adicionado com sucesso.`,
    })

    resetForm()
    onOpenChange(false)
    if (onContactCreated) {
      onContactCreated(created)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="bg-[#222e35] border-[#2f3b43] text-slate-100 w-[95vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-[#00a884]" />
            <span>Novo Contato</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Nome completo <span className="text-[#00a884]">*</span>
            </label>
            <Input
              placeholder="Ex: Gabriela Duarte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#2a3942] border-[#374248] text-white"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Número de telefone <span className="text-[#00a884]">*</span>
            </label>
            <Input
              type="tel"
              placeholder="+55 11 99999-8888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-[#2a3942] border-[#374248] text-white"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Você pode digitar e editar o DDD e número normalmente.
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Recado / Status</label>
            <Input
              placeholder="Ex: Olá! Estou usando o WhatsApp."
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="bg-[#2a3942] border-[#374248] text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Estágio inicial no CRM</label>
            <div className="flex flex-wrap gap-1.5">
              {crmStageList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStageId(s.id)}
                  className={`flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    s.id === stageId
                      ? 'bg-[#2a3942] border-[#00a884] text-white'
                      : 'bg-[#182229] border-[#2a3942] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot} mr-1.5`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
              className="text-slate-300 hover:text-white h-10 w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#00a884] hover:bg-[#008f6f] text-white h-10 w-full sm:w-auto font-medium"
            >
              Salvar Contato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
