import React, { useState } from 'react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { MessageSquare, ArrowRight, ShieldCheck, Sparkles, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

const AVATAR_OPTIONS = [
  'https://img.usecurling.com/ppl/medium?gender=male&seed=88',
  'https://img.usecurling.com/ppl/medium?gender=female&seed=15',
  'https://img.usecurling.com/ppl/medium?gender=male&seed=33',
  'https://img.usecurling.com/ppl/medium?gender=female&seed=67',
  'https://img.usecurling.com/ppl/medium?gender=male&seed=92',
  'https://img.usecurling.com/ppl/medium?gender=female&seed=44',
]

interface EntryScreenProps {
  onComplete: () => void
}

export const EntryScreen: React.FC<EntryScreenProps> = ({ onComplete }) => {
  const { user, setUser } = useWhatsApp()
  const [name, setName] = useState(user.name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || AVATAR_OPTIONS[0])
  const [phone, setPhone] = useState(user.phone || '+55 11 98765-4321')
  const [error, setError] = useState('')

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Por favor, informe seu nome para começar.')
      return
    }

    setUser({
      ...user,
      name: name.trim(),
      phone: phone.trim(),
      avatar: selectedAvatar,
    })
    onComplete()
  }

  return (
    <div className="min-h-screen bg-[#111b21] flex flex-col justify-between text-slate-100 relative overflow-hidden">
      {/* Decorative top bar like WhatsApp Web login */}
      <div className="h-44 bg-[#00a884] absolute top-0 left-0 right-0 z-0">
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center space-x-3 text-white font-medium text-xl">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span>WHATSAPP WEB</span>
          </div>
          <div className="text-sm text-white/90 hidden sm:flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Ambiente seguro de demonstração</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-lg bg-[#222e35] border-[#2f3b43] text-slate-100 shadow-2xl rounded-2xl overflow-hidden">
          <div className="bg-[#1f2c34] p-6 border-b border-[#2a3942] text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center mb-3">
              <Smartphone className="w-8 h-8 text-[#00a884]" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Entrar no WhatsApp Web</h1>
            <p className="text-sm text-slate-400 mt-1">
              Digite seu nome para inicializar suas conversas, mídias e grupos
            </p>
          </div>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleStart} className="space-y-6">
              {/* Choose avatar */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Escolha seu avatar
                </label>
                <div className="flex items-center justify-center gap-3 py-2 overflow-x-auto">
                  {AVATAR_OPTIONS.map((imgUrl, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedAvatar(imgUrl)}
                      className={`relative rounded-full transition-all p-0.5 ${
                        selectedAvatar === imgUrl
                          ? 'ring-2 ring-[#00a884] scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Avatar ${index + 1}`}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {selectedAvatar === imgUrl && (
                        <div className="absolute -bottom-1 -right-1 bg-[#00a884] rounded-full p-0.5">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name input */}
              <div>
                <label
                  htmlFor="user-name"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Seu nome ou apelido <span className="text-[#00a884]">*</span>
                </label>
                <Input
                  id="user-name"
                  type="text"
                  placeholder="Ex: João Silva ou Mariana"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (error) setError('')
                  }}
                  className="bg-[#2a3942] border-[#374248] text-white placeholder-slate-400 focus-visible:ring-[#00a884] h-12 text-base"
                  autoFocus
                />
                {error && <p className="text-sm text-red-400 mt-1.5 font-medium">{error}</p>}
              </div>

              {/* Optional Phone */}
              <div>
                <label
                  htmlFor="user-phone"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Número de telefone (exemplo demonstrativo)
                </label>
                <Input
                  id="user-phone"
                  type="text"
                  placeholder="+55 11 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-[#2a3942] border-[#374248] text-white placeholder-slate-400 focus-visible:ring-[#00a884] h-11"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium py-6 text-base transition-colors shadow-lg shadow-[#00a884]/20 flex items-center justify-center space-x-2"
                >
                  <span>Iniciar Sessão</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </div>

              <div className="text-center text-xs text-slate-400 pt-2 flex flex-col items-center space-y-1">
                <span>Versão de demonstração com dados de exemplo</span>
                <span className="text-slate-500">
                  Suporta envio de mensagens, fotos, vídeos, criação de grupos e contatos
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-xs text-slate-500 border-t border-[#222e35] z-10 bg-[#111b21]">
        Clone do WhatsApp Web • Desenvolvido com React, Tailwind CSS e TypeScript
      </div>
    </div>
  )
}
