import React from 'react'
import { Image as ImageIcon, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { MessageMedia } from '@/types/whatsapp'

export const SAMPLE_MEDIA_OPTIONS = [
  {
    type: 'image' as const,
    label: 'Foto de Natureza',
    url: 'https://img.usecurling.com/p/800/600?q=landscape&color=green',
    fileName: 'natureza_montanha.jpg',
    fileSize: '2.1 MB',
  },
  {
    type: 'image' as const,
    label: 'Design de Dashboard',
    url: 'https://img.usecurling.com/p/800/600?q=dashboard&color=blue',
    fileName: 'dashboard_interface.png',
    fileSize: '1.2 MB',
  },
  {
    type: 'image' as const,
    label: 'Foto de Escritório',
    url: 'https://img.usecurling.com/p/800/600?q=office&color=gray',
    fileName: 'escritorio_equipe.jpg',
    fileSize: '3.4 MB',
  },
  {
    type: 'video' as const,
    label: 'Amostra de Vídeo Curto',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    fileName: 'apresentacao_projeto.mp4',
    fileSize: '8.7 MB',
  },
]

interface MessageMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSendMedia: (media: MessageMedia) => void
}

export const MessageMediaDialog: React.FC<MessageMediaDialogProps> = ({
  open,
  onOpenChange,
  onSendMedia,
}) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState<
    (typeof SAMPLE_MEDIA_OPTIONS)[0] | null
  >(null)
  const [customUrl, setCustomUrl] = React.useState('')
  const [customType, setCustomType] = React.useState<'image' | 'video'>('image')
  const [caption, setCaption] = React.useState('')

  const handleSend = () => {
    if (customUrl.trim()) {
      onSendMedia({
        type: customType,
        url: customUrl.trim(),
        caption: caption.trim() || undefined,
        fileName: customType === 'video' ? 'video_anexo.mp4' : 'foto_anexo.jpg',
        fileSize: 'Aprox. 2 MB',
      })
    } else if (selectedTemplate) {
      onSendMedia({
        type: selectedTemplate.type,
        url: selectedTemplate.url,
        caption: caption.trim() || selectedTemplate.label,
        fileName: selectedTemplate.fileName,
        fileSize: selectedTemplate.fileSize,
      })
    } else {
      return
    }

    setCaption('')
    setSelectedTemplate(null)
    setCustomUrl('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#222e35] border-[#2f3b43] text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center space-x-2">
            <ImageIcon className="w-5 h-5 text-[#00a884]" />
            <span>Enviar Foto ou Vídeo</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">
              Escolha uma mídia de amostra pronta:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_MEDIA_OPTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(item)
                    setCustomUrl('')
                  }}
                  className={`flex items-center space-x-2 p-2 rounded-lg border text-left transition-all ${
                    selectedTemplate?.url === item.url
                      ? 'border-[#00a884] bg-[#00a884]/15'
                      : 'border-[#2f3b43] bg-[#1f2c34] hover:bg-[#2a3942]'
                  }`}
                >
                  {item.type === 'video' ? (
                    <Video className="w-6 h-6 text-amber-400 shrink-0" />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.label}
                      className="w-8 h-8 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-slate-200 truncate">{item.label}</p>
                    <p className="text-[10px] text-slate-400">{item.fileSize}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#2a3942]"></div>
            <span className="flex-shrink mx-3 text-xs text-slate-400 uppercase">
              Ou informe uma URL
            </span>
            <div className="flex-grow border-t border-[#2a3942]"></div>
          </div>

          <div className="space-y-2">
            <div className="flex space-x-2">
              <Button
                type="button"
                size="sm"
                variant={customType === 'image' ? 'default' : 'outline'}
                onClick={() => setCustomType('image')}
                className={
                  customType === 'image'
                    ? 'bg-[#00a884] text-white hover:bg-[#008f6f]'
                    : 'border-[#374248] text-slate-300'
                }
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1" />
                Imagem
              </Button>
              <Button
                type="button"
                size="sm"
                variant={customType === 'video' ? 'default' : 'outline'}
                onClick={() => setCustomType('video')}
                className={
                  customType === 'video'
                    ? 'bg-[#00a884] text-white hover:bg-[#008f6f]'
                    : 'border-[#374248] text-slate-300'
                }
              >
                <Video className="w-3.5 h-3.5 mr-1" />
                Vídeo
              </Button>
            </div>

            <Input
              placeholder="https://... URL pública de imagem ou mp4"
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value)
                if (e.target.value) setSelectedTemplate(null)
              }}
              className="bg-[#2a3942] border-[#374248] text-white placeholder-slate-400 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Legenda da mídia (opcional)</label>
            <Input
              placeholder="Adicione uma legenda..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="bg-[#2a3942] border-[#374248] text-white placeholder-slate-400 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-300 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!customUrl.trim() && !selectedTemplate}
            className="bg-[#00a884] hover:bg-[#008f6f] text-white"
          >
            Enviar Mídia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
