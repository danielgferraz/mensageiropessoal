import React from 'react'
import { X, Download, Share2, ZoomIn, ZoomOut, Maximize2, FileVideo, FileImage } from 'lucide-react'
import { MessageMedia } from '@/types/whatsapp'
import { Button } from '@/components/ui/button'

interface MediaViewerModalProps {
  media: MessageMedia | null
  onClose: () => void
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ media, onClose }) => {
  const [zoom, setZoom] = React.useState(1)

  if (!media) return null

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleResetZoom = () => setZoom(1)

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between animate-fade-in backdrop-blur-sm">
      {/* Top action bar */}
      <div className="h-16 px-4 flex items-center justify-between text-white border-b border-white/10 bg-black/40">
        <div className="flex items-center space-x-3">
          {media.type === 'video' ? (
            <FileVideo className="w-5 h-5 text-emerald-400" />
          ) : (
            <FileImage className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <h3 className="text-sm font-medium line-clamp-1">
              {media.fileName || (media.type === 'video' ? 'Vídeo' : 'Foto')}
            </h3>
            {media.fileSize && <span className="text-xs text-white/60">{media.fileSize}</span>}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {media.type === 'image' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="text-white hover:bg-white/10 rounded-full"
                title="Diminuir zoom"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                className="text-white hover:bg-white/10 rounded-full text-xs font-mono"
                title="Redefinir zoom"
              >
                {Math.round(zoom * 100)}%
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="text-white hover:bg-white/10 rounded-full"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
            </>
          )}

          <a
            href={media.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            title="Abrir original"
          >
            <Download className="w-5 h-5" />
          </a>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded-full"
            title="Fechar (Esc)"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Main viewer content */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden relative cursor-default select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      >
        {media.type === 'image' ? (
          <div className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200">
            <img
              src={media.url}
              alt={media.caption || 'Visualização de imagem'}
              style={{ transform: `scale(${zoom})` }}
              className="max-h-[82vh] max-w-[90vw] object-contain rounded shadow-2xl transition-transform"
            />
          </div>
        ) : (
          <div className="w-full max-w-4xl max-h-[80vh] flex items-center justify-center">
            <video
              src={media.url}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full rounded shadow-2xl bg-black"
            >
              Seu navegador não suporta a tag de vídeo.
            </video>
          </div>
        )}
      </div>

      {/* Caption footer if present */}
      {media.caption && (
        <div className="p-4 bg-black/60 border-t border-white/10 text-center text-white text-sm max-w-2xl mx-auto rounded-t-xl">
          <p>{media.caption}</p>
        </div>
      )}
    </div>
  )
}
