import React, { useState } from 'react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { EntryScreen } from '@/components/EntryScreen'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { ContactsPanel } from '@/components/ContactsPanel'
import { NewGroupPanel } from '@/components/NewGroupPanel'
import { ProfilePanel } from '@/components/ProfilePanel'
import { GroupInfoPanel } from '@/components/GroupInfoPanel'
import { MediaViewerModal } from '@/components/MediaViewerModal'
import { FeatureRail, LeftPanel } from '@/components/FeatureRail'
import { CrmPanel } from '@/components/CrmPanel'

export default function Index() {
  const {
    user,
    setUser,
    activeChatId,
    setActiveChatId,
    activeMedia,
    setActiveMedia,
    startChatWithContact,
  } = useWhatsApp()

  // Track active subpanels on the left side
  const [activeLeftPanel, setActiveLeftPanel] = useState<LeftPanel>('chats')

  // Abrir uma conversa a partir de outra tela (ex.: CRM) sem quebrar o chat
  const openChatWithContact = (contactId: string) => {
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

        {activeLeftPanel === 'crm' ? (
          /* Tela de CRM ocupa toda a área de conteúdo */
          <CrmPanel onBack={() => setActiveLeftPanel('chats')} onOpenChat={openChatWithContact} />
        ) : (
          <>
            {/* Left Side (Sidebar or specialized panels) */}
            <div
              className={`h-full ${
                activeChatId ? 'hidden md:flex' : 'flex'
              } w-full md:w-[380px] lg:w-[420px] shrink-0 transition-all`}
            >
              {activeLeftPanel === 'chats' && (
                <Sidebar
                  onOpenContacts={() => setActiveLeftPanel('contacts')}
                  onOpenNewGroup={() => setActiveLeftPanel('new-group')}
                  onOpenProfile={() => setActiveLeftPanel('profile')}
                  onLogout={handleLogout}
                />
              )}

              {activeLeftPanel === 'contacts' && (
                <ContactsPanel onClose={() => setActiveLeftPanel('chats')} />
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
            </div>

            {/* Right Side (Active Chat View) */}
            <div className={`flex-1 h-full ${!activeChatId ? 'hidden md:flex' : 'flex'} min-w-0`}>
              <ChatArea
                onBackMobile={() => setActiveChatId(null)}
                onOpenGroupInfo={() => setShowGroupInfo(true)}
              />

              {/* Group details right-dock panel */}
              {showGroupInfo && activeChatId && (
                <GroupInfoPanel
                  conversationId={activeChatId}
                  onClose={() => setShowGroupInfo(false)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Media Viewer Modal */}
      {activeMedia && <MediaViewerModal media={activeMedia} onClose={() => setActiveMedia(null)} />}
    </div>
  )
}
