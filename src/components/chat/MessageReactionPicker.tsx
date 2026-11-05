import React from 'react'
import { WHATSAPP_REACTION_EMOJIS } from '@/data/labelsData'

interface MessageReactionPickerProps {
  onSelectEmoji: (emoji: string) => void
  currentReactions?: string[]
}

export const MessageReactionPicker: React.FC<MessageReactionPickerProps> = ({
  onSelectEmoji,
  currentReactions = [],
}) => {
  return (
    <div
      className="flex items-center gap-1 bg-[#202c33] border border-[#2a3942] rounded-full px-2 py-1 shadow-lg backdrop-blur-md animate-scale-in select-none z-30"
      onClick={(e) => e.stopPropagation()}
    >
      {WHATSAPP_REACTION_EMOJIS.map((emoji) => {
        const isSelected = currentReactions.includes(emoji)
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            className={`text-lg sm:text-xl p-1 rounded-full hover:scale-125 transition-transform active:scale-95 flex items-center justify-center ${
              isSelected ? 'bg-[#00a884]/20 scale-110' : 'hover:bg-[#374248]/50'
            }`}
            title={`Reagir com ${emoji}`}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}
