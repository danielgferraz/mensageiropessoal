import React, { useState } from 'react'
import { ArrowLeft, Camera, Check, Edit2, Shield, Smartphone, User } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface ProfilePanelProps {
  onClose: () => void
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ onClose }) => {
  const { user, setUser } = useWhatsApp()
  const [name, setName] = useState(user.name)
  const [about, setAbout] = useState(user.about)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingAbout, setIsEditingAbout] = useState(false)

  const { toast } = useToast()

  const handleSaveName = () => {
    if (!name.trim()) return
    setUser({ ...user, name: name.trim() })
    setIsEditingName(false)
    toast({ title: 'Nome atualizado' })
  }

  const handleSaveAbout = () => {
    setUser({ ...user, about: about.trim() })
    setIsEditingAbout(false)
    toast({ title: 'Recado atualizado' })
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] wa-panel-separator-right text-slate-100 z-30 shrink-0 shadow-2xl animate-in slide-in-from-left duration-200">
      {/* Header — Painel lateral esquerdo de Perfil */}
      <div className="h-16 px-4 wa-header-sidebar flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="wa-header-btn rounded-full -ml-2"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-base font-semibold wa-header-title">Perfil</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Photo Section */}
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-40 h-40 rounded-full object-cover shadow-xl ring-2 ring-[#00a884]/40 group-hover:opacity-80 transition-opacity"
            />
            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white mb-1" />
              <span className="text-[10px] uppercase font-bold text-white tracking-wider">
                Mudar foto
              </span>
            </div>
          </div>
        </div>

        {/* User Name */}
        <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942]">
          <div className="text-xs text-[#00a884] font-medium mb-1">Seu nome</div>
          {isEditingName ? (
            <div className="flex items-center space-x-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[#2a3942] border-[#374248] text-white h-9"
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSaveName}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white shrink-0 h-9 w-9"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-slate-100">{user.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingName(true)}
                className="text-slate-400 hover:text-white"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Esse não é seu nome de usuário ou PIN. Esse nome será exibido para seus contatos do
            WhatsApp.
          </p>
        </div>

        {/* Recado / Status */}
        <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942]">
          <div className="text-xs text-[#00a884] font-medium mb-1">Recado</div>
          {isEditingAbout ? (
            <div className="flex items-center space-x-2">
              <Input
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="bg-[#2a3942] border-[#374248] text-white h-9"
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSaveAbout}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white shrink-0 h-9 w-9"
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200">{user.about}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingAbout(true)}
                className="text-slate-400 hover:text-white"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="bg-[#182229] p-4 rounded-xl border border-[#2a3942]">
          <div className="text-xs text-[#00a884] font-medium mb-1">Número de telefone</div>
          <div className="flex items-center space-x-2 text-slate-300 text-sm">
            <Smartphone className="w-4 h-4 text-slate-400" />
            <span>{user.phone || '+55 11 98765-4321'}</span>
          </div>
        </div>

        <div className="p-4 bg-[#0c1317] rounded-xl border border-[#2a3942] text-xs text-slate-400 space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
            <Shield className="w-4 h-4 text-[#00a884]" />
            <span>Ambiente Demonstrativo</span>
          </div>
          <p>
            Suas configurações ficam gravadas na memória do navegador para uma experiência contínua
            e realista de WhatsApp Web.
          </p>
        </div>
      </div>
    </div>
  )
}
