import { RefreshCw, Smartphone } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'

export const ConnectionsSettingsTab = () => {
  const { instanceName, loading, syncError, refresh } = useWhatsApp()
  return (
    <section className="space-y-4 p-4 text-slate-200">
      <h3 className="flex items-center gap-2 font-medium"><Smartphone className="h-5 w-5" />Conexão WhatsApp</h3>
      <p role="status">{loading ? 'Consultando conexão…' : instanceName ? `Instância ${instanceName} selecionada automaticamente.` : 'Nenhuma instância conectada.'}</p>
      {syncError && <p role="alert" className="text-red-300">{syncError}</p>}
      <p className="text-sm text-slate-400">A conexão e as credenciais são gerenciadas no servidor. Não é necessário informar uma chave de API.</p>
      <Button variant="secondary" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Verificar conexão</Button>
    </section>
  )
}
