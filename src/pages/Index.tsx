import React, { useState } from 'react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { EntryScreen } from '@/components/EntryScreen'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { NewGroupPanel } from '@/components/NewGroupPanel'
import { ProfilePanel } from '@/components/ProfilePanel'
import { GroupInfoPanel } from '@/components/GroupInfoPanel'
import { MediaViewerModal } from '@/components/MediaViewerModal'
import { ContactsCrmPanel } from '@/components/ContactsCrmPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { FeatureRail, LeftPanel } from '@/components/FeatureRail'
import { ContactDetailsModal } from '@/components/ContactDetailsModal'
import { Contact } from '@/types/whatsapp'

export default function Index() {
  const {
    user,
    setUser,
    contacts,
    activeChatId,
    setActiveChatId,
    activeMedia,
    setActiveMedia,
    startChatWithContact,
  } = useWhatsApp()

  // Track active subpanels on the left side
  const [activeLeftPanel, setActiveLeftPanel] = useState<LeftPanel>('chats')

  // Detalhes de contato abertos a partir da lista de conversas (clique no cabeçalho do chat)
  const [openContactId, setOpenContactId] = useState<string | null>(null)
  const openContact = openContactId ? contacts.find((c) => c.id === openContactId) || null : null

  // Abrir uma conversa a partir de outra tela (contatos, CRM, modal) sem quebrar o chat
  const openChatWithContact = (contactId: string) => {
    setOpenContactId(null)
    setActiveLeftPanel('chats')
    startChatWithContact(contactId)
  }

  // Track right-side info panel (e.g. Group Info)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  // If user has not set their name yet, show entry onboarding screen
  if (!user.name) {
    return <EntryScreen onComplete={() => setActiveLeftPanel('chats')} />
  }

  const handleLogout = () => {
    setUser({ ...user, name: '' })
    setActiveChatId(null)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c1317]">
      {/* Outer WhatsApp Web container layout */}
      <div className="flex h-full w-full max-w-[1680px] mx-auto shadow-2xl relative overflow-hidden bg-[#111b21]">
        {/* Menu lateral recolhível de funcionalidades */}
        <FeatureRail activePanel={activeLeftPanel} onSelect={setActiveLeftPanel} />

        {/* Left Side (Sidebar or specialized panels) */}
        <div
          className={`h-full ${
            activeChatId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[380px] lg:w-[420px] shrink-0 transition-all ${
            activeLeftPanel === 'contacts' ? 'md:!w-auto md:flex-1 md:min-w-0' : ''
          }`}
        >
          {activeLeftPanel === 'chats' && (
            <Sidebar
              onOpenContacts={() => setActiveLeftPanel('contacts')}
              onOpenNewGroup={() => setActiveLeftPanel('new-group')}
              onOpenProfile={() => setActiveLeftPanel('profile')}
              onLogout={handleLogout}
            />
          )}

          {/* Tela unificada de Contatos + CRM */}
          {activeLeftPanel === 'contacts' && (
            <div className="flex-1 min-w-0 flex">
              <ContactsCrmPanel
                onClose={() => setActiveLeftPanel('chats')}
                onOpenChat={openChatWithContact}
              />
            </div>
          )}

          {activeLeftPanel === 'new-group' && (
            <NewGroupPanel
              onClose={() => setActiveLeftPanel('chats')}
              onGroupCreated={() => setActiveLeftPanel('chats')}
            />
          )}

          {activeLeftPanel === 'profile' && (
            <ProfilePanel onClose={() => setActiveLeftPanel('chats')} />
          )}

          {activeLeftPanel === 'settings' && (
            <SettingsPanel onClose={() => setActiveLeftPanel('chats')} />
          )}
        </div>

        {/* Right Side (Active Chat View) */}
        <div className={`flex-1 h-full ${!activeChatId ? 'hidden md:flex' : 'flex'} min-w-0`}>
          <ChatArea
            onBackMobile={() => setActiveChatId(null)}
            onOpenGroupInfo={() => setShowGroupInfo(true)}
            onOpenContactDetails={
              activeChatId && !activeChatId.startsWith('conv-group-')
                ? (contactId) => setOpenContactId(contactId)
                : undefined
            }
          />

          {/* Group details right-dock panel */}
          {showGroupInfo && activeChatId && (
            <GroupInfoPanel conversationId={activeChatId} onClose={() => setShowGroupInfo(false)} />
          )}
        </div>
      </div>

      {/* Modal de detalhes do contato (a partir da lista de conversas) */}
      <ContactDetailsModal
        contact={openContact}
        onClose={() => setOpenContactId(null)}
        onOpenChat={openChatWithContact}
      />

      {/* Fullscreen Media Viewer Modal */}
      {activeMedia && <MediaViewerModal media={activeMedia} onClose={() => setActiveMedia(null)} />}
    </div>
  )
}
