import React, { useState } from 'react'
import {
  Server,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  Info,
  AlertTriangle,
  KeyRound,
  Layers,
  Sparkles,
} from 'lucide-react'
import { EvolutionConnection } from '@/types/whatsapp'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { useToast } from '@/hooks/use-toast'

export const ConnectionsSettingsTab: React.FC = () => {
  const { connections, addConnection, updateConnection, deleteConnection, setActiveConnection } =
    useWhatsApp()
  const { toast } = useToast()

  // Visibilidade da chave por id de conexão
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})

  // Diálogo de Criar / Editar
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    serverUrl: '',
    apiKey: '',
    instanceName: '',
    isActive: false,
  })

  // Diálogo de Confirmação para Excluir
  const [deletingConnection, setDeletingConnection] = useState<EvolutionConnection | null>(null)

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData({
      name: '',
      serverUrl: 'https://',
      apiKey: '',
      instanceName: '',
      isActive: connections.length === 0,
    })
    setFormOpen(true)
  }

  const handleOpenEdit = (conn: EvolutionConnection) => {
    setEditingId(conn.id)
    setFormData({
      name: conn.name,
      serverUrl: conn.serverUrl,
      apiKey: conn.apiKey,
      instanceName: conn.instanceName,
      isActive: !!conn.isActive,
    })
    setFormOpen(true)
  }

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Dê um nome para identificar a conexão.',
        variant: 'destructive',
      })
      return
    }

    if (!formData.serverUrl.trim() || formData.serverUrl.trim() === 'https://') {
      toast({
        title: 'Endereço obrigatório',
        description: 'Informe a URL do servidor da Evolution API.',
        variant: 'destructive',
      })
      return
    }

    if (editingId) {
      updateConnection(editingId, {
        name: formData.name,
        serverUrl: formData.serverUrl,
        apiKey: formData.apiKey,
        instanceName: formData.instanceName,
        isActive: formData.isActive,
      })
      toast({
        title: 'Conexão atualizada',
        description: `Dados de "${formData.name.trim()}" foram salvos.`,
      })
    } else {
      addConnection({
        name: formData.name,
        serverUrl: formData.serverUrl,
        apiKey: formData.apiKey,
        instanceName: formData.instanceName,
        isActive: formData.isActive,
      })
      toast({
        title: 'Conexão cadastrada',
        description: `Conexão "${formData.name.trim()}" salva com sucesso.`,
      })
    }

    setFormOpen(false)
  }

  const handleConfirmDelete = () => {
    if (!deletingConnection) return
    deleteConnection(deletingConnection.id)
    toast({
      title: 'Conexão removida',
      description: `"${deletingConnection.name}" foi excluída.`,
    })
    setDeletingConnection(null)
  }

  return (
    <div className="space-y-4">
      {/* Banner de aviso explicativo */}
      <div className="p-3 bg-[#182229] rounded-xl border border-[#00a884]/30 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white">Cadastro local para integração futura:</strong> configure
          os dados da sua Evolution API (v1 ou v2). As instâncias cadastradas aqui persistem no
          navegador e servirão para sincronização em etapas futuras.
        </div>
      </div>

      {/* Cabeçalho com botão de cadastro */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center">
            <Server className="w-4 h-4 mr-1.5 text-[#00a884]" />
            Conexões Evolution API
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Gerencie múltiplos servidores e instâncias de mensageria.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleOpenCreate}
          className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs h-8 px-3 space-x-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova conexão</span>
        </Button>
      </div>

      {/* Lista de conexões */}
      {connections.length === 0 ? (
        <div className="bg-[#182229] p-8 rounded-xl border border-[#2a3942] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#2a3942] flex items-center justify-center mx-auto text-slate-400">
            <Server className="w-6 h-6 text-slate-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">Nenhuma conexão cadastrada</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Clique em &quot;Nova conexão&quot; para registrar os parâmetros do seu servidor
              Evolution API (URL, API Key e Instância).
            </p>
          </div>
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs h-8 px-3 space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar primeira conexão</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => {
            const isKeyVisible = !!visibleKeys[conn.id]

            return (
              <div
                key={conn.id}
                className={`bg-[#182229] p-4 rounded-xl border transition-all ${
                  conn.isActive
                    ? 'border-[#00a884] shadow-md shadow-[#00a884]/10'
                    : 'border-[#2a3942] hover:border-[#374248]'
                }`}
              >
                {/* Linha superior: Nome, badge de ativa e ações */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-slate-100 truncate">{conn.name}</h4>
                      {conn.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Ativa / Padrão
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveConnection(conn.id)}
                          className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded-full border border-[#2a3942] hover:border-[#374248] transition-colors"
                          title="Tornar esta conexão a ativa/padrão"
                        >
                          Tornar ativa
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                      {conn.serverUrl}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(conn)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#2a3942] transition-colors"
                      title="Editar conexão"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingConnection(conn)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-[#2a3942] transition-colors"
                      title="Excluir conexão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Detalhes: Instância e Chave API */}
                <div className="mt-3 pt-3 border-t border-[#2a3942] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#202c33] p-2 rounded-lg border border-[#2a3942]/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      Instância
                    </span>
                    <span className="text-slate-200 font-mono text-[11px] truncate block mt-0.5">
                      {conn.instanceName || '(não informada)'}
                    </span>
                  </div>

                  <div className="bg-[#202c33] p-2 rounded-lg border border-[#2a3942]/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Chave API
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(conn.id)}
                        className="text-slate-400 hover:text-white text-[10px] flex items-center"
                        title={isKeyVisible ? 'Ocultar chave' : 'Mostrar chave'}
                      >
                        {isKeyVisible ? (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" />
                            Ocultar
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            Mostrar
                          </>
                        )}
                      </button>
                    </div>
                    <span className="text-slate-200 font-mono text-[11px] truncate block mt-0.5">
                      {conn.apiKey
                        ? isKeyVisible
                          ? conn.apiKey
                          : '••••••••••••••••••••••••'
                        : '(sem chave)'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Diálogo de Criar / Editar Conexão — responsivo em tela cheia no mobile */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 w-[95vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-100 flex items-center">
              <Server className="w-4 h-4 mr-2 text-[#00a884]" />
              {editingId ? 'Editar Conexão Evolution API' : 'Nova Conexão Evolution API'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveForm} className="space-y-3.5 py-2">
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Nome da Conexão *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Servidor Produção ou Atendimento 01"
                className="bg-[#2a3942] border-[#374248] text-white text-xs h-10 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Endereço do Servidor (URL) *
              </label>
              <Input
                value={formData.serverUrl}
                onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                placeholder="https://api.seuservidor.com"
                className="bg-[#2a3942] border-[#374248] text-white text-xs h-10 font-mono rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">
                  Nome da Instância
                </label>
                <Input
                  value={formData.instanceName}
                  onChange={(e) => setFormData({ ...formData, instanceName: e.target.value })}
                  placeholder="Ex: whatsapp-principal"
                  className="bg-[#2a3942] border-[#374248] text-white text-xs h-10 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">
                  Chave da API (Global / Instance)
                </label>
                <Input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Sua chave secreta..."
                  className="bg-[#2a3942] border-[#374248] text-white text-xs h-10 font-mono rounded-lg"
                />
              </div>
            </div>

            <div className="pt-1 flex items-center space-x-2">
              <input
                type="checkbox"
                id="check-is-active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-[#374248] bg-[#2a3942] text-[#00a884] focus:ring-[#00a884] w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor="check-is-active"
                className="text-xs text-slate-300 cursor-pointer select-none"
              >
                Definir como conexão padrão / ativa
              </label>
            </div>

            <DialogFooter className="pt-3 flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
                className="bg-transparent border-[#374248] text-slate-300 hover:bg-[#2a3942] hover:text-white text-xs h-10 w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold h-10 w-full sm:w-auto"
              >
                {editingId ? 'Salvar alterações' : 'Cadastrar conexão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para exclusão */}
      <AlertDialog
        open={!!deletingConnection}
        onOpenChange={(open) => !open && setDeletingConnection(null)}
      >
        <AlertDialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 w-[95vw] max-w-sm rounded-2xl p-4 sm:p-6">
          <AlertDialogHeader>
            <div className="flex items-center space-x-2 text-red-400 mb-1">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <AlertDialogTitle className="text-base text-slate-100">
                Excluir conexão?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed">
              Você está prestes a excluir a conexão{' '}
              <strong className="text-white">&quot;{deletingConnection?.name}&quot;</strong>. Esta
              ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2 pt-2">
            <AlertDialogCancel
              onClick={() => setDeletingConnection(null)}
              className="bg-transparent border-[#374248] text-slate-300 hover:bg-[#2a3942] hover:text-white text-xs h-10 w-full sm:w-auto mt-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-10 w-full sm:w-auto"
            >
              Excluir conexão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
