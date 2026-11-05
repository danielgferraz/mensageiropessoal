import React, { useState, useEffect, useCallback } from 'react'
import {
  QrCode,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Radio,
  ExternalLink,
  ShieldCheck,
  Server,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { apiFetch } from '@/lib/api'

interface NewInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface EvolutionInstanceItem {
  id?: string
  name: string
  connectionStatus?: string
  ownerJid?: string
  profileName?: string
  profilePicUrl?: string
  number?: string
  integration?: string
}

export const NewInstanceDialog: React.FC<NewInstanceDialogProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast()
  const { addLog } = useWhatsApp()

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [instances, setInstances] = useState<EvolutionInstanceItem[]>([])
  const [loadingList, setLoadingList] = useState(false)

  // Formulário de criação
  const [instanceName, setInstanceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [activeCreatedName, setActiveCreatedName] = useState<string | null>(null)

  // QR Code e status
  const [qrCodeData, setQrCodeData] = useState<{
    base64?: string
    code?: string
    pairingCode?: string
    state?: string
  } | null>(null)
  const [connectionState, setConnectionState] = useState<string>('idle')
  const [pollingActive, setPollingActive] = useState(false)

  // Buscar instâncias existentes
  const fetchInstances = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await apiFetch('/mensageiro/api/whatsapp/instances')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setInstances(data)
        }
      }
    } catch (err) {
      console.error('Erro ao buscar instâncias:', err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchInstances()
    } else {
      setPollingActive(false)
      setQrCodeData(null)
      setConnectionState('idle')
    }
  }, [open, fetchInstances])

  // Polling de status enquanto aguarda conexão
  useEffect(() => {
    if (!pollingActive || !activeCreatedName) return

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/mensageiro/api/whatsapp/status/${encodeURIComponent(activeCreatedName)}`)
        if (res.ok) {
          const data = await res.json()
          const state = data?.instance?.state || data?.state
          if (state) {
            setConnectionState(state)
            if (state === 'open') {
              setPollingActive(false)
              toast({
                title: 'WhatsApp Conectado!',
                description: `A instância "${activeCreatedName}" está conectada e pronta para uso.`,
              })
              addLog('WHATSAPP_CONNECT', `Instância ${activeCreatedName} conectada com sucesso`, 'success')
              fetchInstances()
            }
          }
        }
      } catch (err) {
        console.warn('Polling status error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [pollingActive, activeCreatedName, fetchInstances, toast, addLog])

  // Submissão: Criar instância
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = instanceName.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    if (!cleanName) {
      toast({
        title: 'Nome inválido',
        description: 'Digite um nome sem espaços ou caracteres especiais (ex: atendimento-01).',
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)
    setQrCodeData(null)
    setConnectionState('connecting')

    try {
      const res = await apiFetch('/mensageiro/api/whatsapp/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: cleanName }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || data?.response?.message || 'Falha ao criar instância')
      }

      setActiveCreatedName(cleanName)

      // Extrai dados do QR Code do retorno da criação ou faz connect
      let base64 = data?.qrcode?.base64 || data?.base64
      let pairingCode = data?.qrcode?.pairingCode || data?.pairingCode
      let code = data?.qrcode?.code || data?.code

      // Se não veio QR code no create, solicita ao endpoint connect
      if (!base64 && !pairingCode) {
        const connectRes = await apiFetch(`/mensageiro/api/whatsapp/connect/${encodeURIComponent(cleanName)}`)
        if (connectRes.ok) {
          const connectData = await connectRes.json()
          base64 = connectData?.base64 || connectData?.qrcode?.base64
          pairingCode = connectData?.pairingCode || connectData?.qrcode?.pairingCode
          code = connectData?.code || connectData?.qrcode?.code
        }
      }

      setQrCodeData({ base64, pairingCode, code })
      setPollingActive(true)
      addLog('INSTANCE_CREATE', `Nova instância ${cleanName} criada`, 'info')
      fetchInstances()

      toast({
        title: 'Instância gerada',
        description: 'Escaneie o código QR com seu WhatsApp para conectar.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar criação'
      toast({
        title: 'Erro na criação',
        description: msg,
        variant: 'destructive',
      })
      setConnectionState('error')
    } finally {
      setIsCreating(false)
    }
  }

  // Recarregar QR Code de uma instância existente
  const handleConnectExisting = async (name: string) => {
    setIsCreating(true)
    setActiveCreatedName(name)
    setQrCodeData(null)
    setConnectionState('connecting')
    setActiveTab('create')

    try {
      const res = await apiFetch(`/mensageiro/api/whatsapp/connect/${encodeURIComponent(name)}`)
      const data = await res.json()

      if (data?.instance?.state === 'open') {
        setConnectionState('open')
        toast({
          title: 'Já conectada',
          description: `A instância "${name}" já está aberta e conectada.`,
        })
        return
      }

      const base64 = data?.base64 || data?.qrcode?.base64
      const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode
      const code = data?.code || data?.qrcode?.code

      setQrCodeData({ base64, pairingCode, code })
      setPollingActive(true)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o QR Code da instância.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Excluir instância
  const handleDeleteInstance = async (name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a instância "${name}"?`)) return

    try {
      const res = await apiFetch(`/mensageiro/api/whatsapp/instances/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({
          title: 'Instância removida',
          description: `A instância "${name}" foi excluída.`,
        })
        if (activeCreatedName === name) {
          setActiveCreatedName(null)
          setQrCodeData(null)
        }
        fetchInstances()
      } else {
        throw new Error('Falha ao excluir')
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a instância.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#202c33] border-[#2a3942] text-slate-100 w-[95vw] max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-[#00a884]">
            <div className="w-8 h-8 rounded-full bg-[#00a884]/20 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-[#00a884]" />
            </div>
            <div>
              <DialogTitle className="text-base text-slate-100 flex items-center gap-2">
                Instâncias WhatsApp
                <span className="text-[10px] font-semibold bg-[#00a884]/20 text-[#00a884] px-2 py-0.5 rounded-full border border-[#00a884]/30">
                  Evolution API v2
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Conecte seu WhatsApp gerando um novo QR Code direto pelo mensageiro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Abas Superiores */}
        <div className="flex bg-[#111b21] p-1 rounded-xl border border-[#2a3942] gap-1 my-3">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
              activeTab === 'create'
                ? 'bg-[#00a884] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Instância (QR Code)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('list')
              fetchInstances()
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
              activeTab === 'list'
                ? 'bg-[#00a884] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instâncias Conectadas ({instances.length})</span>
          </button>
        </div>

        {/* ABA: NOVA INSTÂNCIA & QR CODE */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            <form onSubmit={handleCreateInstance} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-medium">
                  Nome da nova instância *
                </label>
                <div className="flex gap-2">
                  <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="Ex: atendimento-01, comercial, bot-ia"
                    className="bg-[#111b21] border-[#2a3942] text-white text-xs h-10 rounded-lg flex-1"
                    disabled={isCreating}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={isCreating || !instanceName.trim()}
                    className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold h-10 px-4 shrink-0"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-3.5 h-3.5 mr-1.5" />
                        Gerar QR Code
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use letras, números e hífens. Uma nova sessão isolada será iniciada no Evolution API.
                </p>
              </div>
            </form>

            {/* ÁREA DE EXIBIÇÃO DO QR CODE */}
            {activeCreatedName && (
              <div className="bg-[#111b21] p-5 rounded-xl border border-[#2a3942] flex flex-col items-center justify-center text-center space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Instância:</span>
                  <span className="text-xs font-bold text-[#00a884] font-mono bg-[#00a884]/10 px-2 py-0.5 rounded border border-[#00a884]/30">
                    {activeCreatedName}
                  </span>
                </div>

                {connectionState === 'open' ? (
                  <div className="py-6 space-y-2 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-[#00a884]/20 border border-[#00a884] flex items-center justify-center text-[#00a884]">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100">WhatsApp Pareado com Sucesso!</h4>
                    <p className="text-xs text-slate-400 max-w-xs">
                      A conexão foi estabelecida com o servidor. As mensagens e contatos agora estão integrados.
                    </p>
                  </div>
                ) : qrCodeData?.base64 ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-200">
                      <img
                        src={qrCodeData.base64}
                        alt="QR Code WhatsApp"
                        className="w-56 h-56 object-contain"
                      />
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Aguardando leitura no aplicativo do WhatsApp...</span>
                    </div>

                    {qrCodeData.pairingCode && (
                      <div className="text-xs text-slate-300">
                        Código de emparelhamento por número:{' '}
                        <strong className="text-white font-mono bg-[#202c33] px-2 py-0.5 rounded">
                          {qrCodeData.pairingCode}
                        </strong>
                      </div>
                    )}

                    <ol className="text-[11px] text-slate-400 text-left list-decimal list-inside space-y-1 bg-[#182229] p-3 rounded-lg border border-[#2a3942] w-full max-w-sm">
                      <li>Abra o WhatsApp no seu celular</li>
                      <li>Toque nos 3 pontos ou Configurações &gt; Aparelhos conectados</li>
                      <li>Toque em &quot;Conectar um aparelho&quot; e aponte para a tela</li>
                    </ol>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConnectExisting(activeCreatedName)}
                      className="text-xs text-slate-300 hover:text-white hover:bg-[#202c33] h-8"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Recarregar QR Code
                    </Button>
                  </div>
                ) : isCreating ? (
                  <div className="py-12 flex flex-col items-center space-y-2">
                    <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
                    <p className="text-xs text-slate-400">Solicitando QR Code à Evolution API...</p>
                  </div>
                ) : (
                  <div className="py-6 text-xs text-slate-400">
                    Clique em &quot;Gerar QR Code&quot; para exibir o código de pareamento.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA: LISTA DE INSTÂNCIAS CONECTADAS */}
        {activeTab === 'list' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Instâncias registradas no servidor</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchInstances}
                disabled={loadingList}
                className="text-xs text-slate-400 hover:text-white h-7 px-2"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loadingList ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {loadingList ? (
              <div className="py-10 text-center">
                <Loader2 className="w-6 h-6 text-[#00a884] animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Carregando instâncias...</p>
              </div>
            ) : instances.length === 0 ? (
              <div className="p-8 text-center bg-[#111b21] rounded-xl border border-[#2a3942] space-y-2">
                <Smartphone className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-medium text-slate-300">Nenhuma instância encontrada</p>
                <p className="text-xs text-slate-500">
                  Crie sua primeira instância na aba &quot;Nova Instância&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {instances.map((inst) => {
                  const isOpen = inst.connectionStatus === 'open'
                  return (
                    <div
                      key={inst.name}
                      className="p-3.5 bg-[#111b21] rounded-xl border border-[#2a3942] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {inst.profilePicUrl ? (
                          <img
                            src={inst.profilePicUrl}
                            alt={inst.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#202c33] border border-[#2a3942] flex items-center justify-center shrink-0 text-[#00a884]">
                            <Smartphone className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              {inst.name}
                            </span>
                            {isOpen ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30 shrink-0">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Conectado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Desconectado
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {inst.profileName || inst.ownerJid || 'Sem telefone registrado'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {!isOpen && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleConnectExisting(inst.name)}
                            className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs h-8 px-2.5 space-x-1"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Conectar</span>
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInstance(inst.name)}
                          className="text-slate-400 hover:text-red-400 hover:bg-[#202c33] h-8 w-8"
                          title="Excluir instância"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
