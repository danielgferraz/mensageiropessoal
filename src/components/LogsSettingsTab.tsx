import React, { useState } from 'react'
import {
  Activity,
  Trash2,
  Filter,
  CheckCircle2,
  Info,
  AlertTriangle,
  Clock,
  Search,
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export const LogsSettingsTab: React.FC = () => {
  const { logs, clearLogs } = useWhatsApp()
  const { toast } = useToast()

  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      log.description.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.timestamp.toLowerCase().includes(term)
    )
  })

  const handleClear = () => {
    clearLogs()
    setConfirmClearOpen(false)
    toast({
      title: 'Logs limpos',
      description: 'O histórico de eventos do aplicativo foi apagado.',
    })
  }

  const getLevelBadge = (level?: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
      case 'warn':
      case 'error':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      default:
        return <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho da aba */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center">
            <Activity className="w-4 h-4 mr-1.5 text-[#00a884]" />
            Registro de Eventos
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Acompanhe ações do sistema em tempo real (mensagens, contatos, CRM e temas).
          </p>
        </div>

        {logs.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClearOpen(true)}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2.5 space-x-1 shrink-0"
            title="Limpar todos os logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar logs</span>
          </Button>
        )}
      </div>

      {/* Barra de pesquisa de logs se houver registros */}
      {logs.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar eventos por descrição..."
            className="bg-[#202c33] border-[#2a3942] pl-8 text-xs text-white h-8"
          />
        </div>
      )}

      {/* Lista de logs */}
      {logs.length === 0 ? (
        <div className="bg-[#182229] p-8 rounded-xl border border-[#2a3942] text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center mx-auto text-slate-400">
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-200">Nenhum evento registrado</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[260px] mx-auto">
            Conforme você envia mensagens, altera contatos, move negócios no CRM ou troca temas, os
            eventos aparecerão aqui.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-[#182229] p-6 rounded-xl border border-[#2a3942] text-center space-y-1">
          <p className="text-xs font-medium text-slate-300">Nenhum evento corresponde ao filtro.</p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-[11px] text-[#00a884] hover:underline"
          >
            Limpar filtro de busca
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-0.5">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-[#182229] p-3 rounded-xl border border-[#2a3942] flex items-start space-x-2.5 transition-colors hover:border-[#374248]"
            >
              <div className="pt-0.5">{getLevelBadge(log.level)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-mono uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-[#2a3942] text-slate-300">
                    {log.action}
                  </span>
                  <span className="flex items-center text-[10px] text-slate-400">
                    <Clock className="w-3 h-3 mr-1 shrink-0" />
                    {log.timestamp}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed break-words font-sans">
                  {log.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmação de limpeza de logs */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center space-x-2 text-red-400 mb-1">
              <Trash2 className="w-5 h-5 shrink-0" />
              <AlertDialogTitle className="text-base text-slate-100">
                Limpar todos os logs?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed">
              Todos os registros de atividades armazenados neste navegador serão apagados. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="space-x-2 pt-2">
            <AlertDialogCancel
              onClick={() => setConfirmClearOpen(false)}
              className="bg-transparent border-[#374248] text-slate-300 hover:bg-[#2a3942] hover:text-white text-xs"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Confirmar e limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
