import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserPlus } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { useToast } from '@/hooks/use-toast'
import { formatPhone } from '@/lib/jids'

interface SaveContactDialogProps {
  conversationId: string | null
  onOpenChange: (open: boolean) => void
}

/** Ação explícita que promove uma conversa avulsa a contato cadastrado (e libera notas, etiquetas e CRM). */
export const SaveContactDialog: React.FC<SaveContactDialogProps> = ({ conversationId, onOpenChange }) => {
  const { conversations, saveConversationAsContact } = useWhatsApp()
  const { toast } = useToast()
  const conversation = conversations.find((c) => c.id === conversationId)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(conversation?.pushName || '')
    setError(null)
  }, [conversationId, conversation?.pushName])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!conversationId) return
    try {
      const saved = saveConversationAsContact(conversationId, name)
      toast({ title: 'Contato salvo', description: `${saved.name} agora está em Contatos e no pipeline.` })
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o contato.')
    }
  }

  return (
    <Dialog open={!!conversationId} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#222e35] border-[#2f3b43] text-slate-100 w-[95vw] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-[#00a884]" />Salvar como contato</DialogTitle>
          <DialogDescription className="text-slate-400">
            {conversation?.phone ? formatPhone(conversation.phone) : 'Número não identificado'}. Só contatos salvos entram em Contatos e no pipeline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="save-contact-name" className="block text-xs text-slate-300">Nome do contato</label>
          <Input id="save-contact-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120}
            className="bg-[#2a3942] border-[#374248] text-white" />
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-[#00a884] text-white hover:bg-[#008f72]">Salvar contato</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
