import { ConversationLabel, QuickReply } from '@/types/whatsapp'

export const LABEL_COLORS = [
  { id: 'emerald', label: 'Verde', bg: '#00a884', text: '#ffffff' },
  { id: 'blue', label: 'Azul', bg: '#007aff', text: '#ffffff' },
  { id: 'orange', label: 'Laranja', bg: '#f59e0b', text: '#ffffff' },
  { id: 'purple', label: 'Roxo', bg: '#8b5cf6', text: '#ffffff' },
  { id: 'pink', label: 'Rosa', bg: '#ec4899', text: '#ffffff' },
  { id: 'cyan', label: 'Ciano', bg: '#06b6d4', text: '#ffffff' },
  { id: 'yellow', label: 'Amarelo', bg: '#eab308', text: '#1c1c1e' },
  { id: 'red', label: 'Vermelho', bg: '#ef4444', text: '#ffffff' },
]

export const DEFAULT_LABELS: ConversationLabel[] = [
  { id: 'lbl-trabalho', name: 'Trabalho', color: '#007aff' },
  { id: 'lbl-cliente', name: 'Novo Cliente', color: '#00a884' },
  { id: 'lbl-familia', name: 'Família', color: '#ec4899' },
  { id: 'lbl-pessoal', name: 'Pessoal', color: '#8b5cf6' },
  { id: 'lbl-urgente', name: 'Urgente', color: '#ef4444' },
]

export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: 'qr-1', shortcut: '/ola', text: 'Olá! Tudo bem? Como posso te ajudar hoje?' },
  { id: 'qr-2', shortcut: '/respondo', text: 'Ok, já te respondo em alguns instantes!' },
  {
    id: 'qr-3',
    shortcut: '/obrigado',
    text: 'Obrigado pelo contato! Qualquer dúvida estou à disposição.',
  },
  {
    id: 'qr-4',
    shortcut: '/proposta',
    text: 'Segue nossa proposta para avaliação. Aguardo seu retorno!',
  },
  { id: 'qr-5', shortcut: '/combinado', text: 'Combinado! Ficamos assim então 👍' },
]

export const WHATSAPP_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
