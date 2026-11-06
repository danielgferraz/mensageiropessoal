import React, { useState } from 'react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { EntryScreen } from '@/components/EntryScreen'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { NewGroupPanel } from '@/components/NewGroupPanel'
import { ProfilePanel } from '@/components/ProfilePanel'
import { GroupInfoPanel } from '@/components/GroupInfoPanel'
import { ContactDetailsDrawer } from '@/components/ContactDetailsDrawer'
import { MediaViewerModal } from '@/components/MediaViewerModal'
import { ContactsCrmPanel } from '@/components/ContactsCrmPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { FeatureRail, LeftPanel } from '@/components/FeatureRail'
import { ContactDetailsModal } from '@/components/ContactDetailsModal'
import { SystemFabMenu } from '@/components/SystemFabMenu'
import { NewContactDialog } from '@/components/NewContactDialog'
import { LabelsManagerDialog } from '@/components/LabelsManagerDialog'
import { NewInstanceDialog } from '@/components/NewInstanceDialog'

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

  // Gaveta lateral mobile (FeatureRail)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Drawer lateral de detalhes do contato ativo (clique no cabeçalho do chat)
  const [activeContactDrawerId, setActiveContactDrawerId] = useState<string | null>(null)

  // Modal modal de detalhes (usado quando vem de listas externas)
  const [modalContactId, setModalContactId] = useState<string | null>(null)
  const modalContact = modalContactId ? contacts.find((c) => c.id === modalContactId) || null : null

  // Abrir uma conversa a partir de outra tela (contatos, CRM, modal) sem quebrar o chat
  const openChatWithContact = (contactId: string) => {
    setModalContactId(null)
    setActiveContactDrawerId(null)
    setActiveLeftPanel('chats')
    startChatWithContact(contactId)
  }

  // Track right-side info panel (e.g. Group Info)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  // Modais de ação rápida acionados pelo FAB e atalhos
  const [fabNewContactOpen, setFabNewContactOpen] = useState(false)
  const [fabLabelsOpen, setFabLabelsOpen] = useState(false)
  const [newInstanceOpen, setNewInstanceOpen] = useState(false)

  // If user has not set their name yet, show entry onboarding screen
  if (!user.name) {
    return <EntryScreen onComplete={() => setActiveLeftPanel('chats')} />
  }

  const handleLogout = () => {
    setUser({ ...user, name: '' })
    setActiveChatId(null)
  }

  return (
    <div className="messenger-app flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#0c1317]">
      {/* Outer WhatsApp Web container layout */}
      <div className="flex h-full w-full max-w-[1680px] mx-auto shadow-2xl relative overflow-hidden bg-[#111b21]">
        {/* Menu lateral recolhível de funcionalidades */}
        <FeatureRail
          activePanel={activeLeftPanel}
          onSelect={(panel) => {
            setActiveLeftPanel(panel)
            setMobileMenuOpen(false)
            if (panel !== 'chats') setActiveChatId(null)
          }}
          onOpenNewInstance={() => setNewInstanceOpen(true)}
          onOpenAntigravity={() => {
            setActiveLeftPanel('chats')
            setActiveChatId('conv-antigravity')
          }}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        {/* Tela unificada de Contatos + CRM em tela cheia (sem painel de chat / placeholder de WhatsApp Web) */}
        {activeLeftPanel === 'contacts' ? (
          <div className="flex-1 h-full min-w-0 flex">
            <ContactsCrmPanel
              onClose={() => setActiveLeftPanel('chats')}
              onOpenChat={openChatWithContact}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
            />
          </div>
        ) : (
          <>
            {/* Left Side (Sidebar or specialized panels) */}
            <div
              className={`messenger-list h-full min-h-0 min-w-0 ${
                activeChatId ? 'hidden md:flex' : 'flex'
              } w-full md:w-[320px] lg:w-[380px] xl:w-[420px] shrink-0`}
            >
              {activeLeftPanel === 'chats' && (
                <Sidebar
                  onOpenContacts={() => setActiveLeftPanel('contacts')}
                  onOpenNewGroup={() => setActiveLeftPanel('new-group')}
                  onOpenProfile={() => setActiveLeftPanel('profile')}
                  onLogout={handleLogout}
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                  onOpenNewInstance={() => setNewInstanceOpen(true)}
                />
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
                <SettingsPanel
                  onClose={() => setActiveLeftPanel('chats')}
                  onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />
              )}
            </div>

            {/* Right Side (Active Chat View / Placeholder apenas para Conversas sem chat) */}
            <div className={`messenger-chat flex-1 h-full min-h-0 ${!activeChatId ? 'hidden md:flex' : 'flex'} min-w-0`}>
              <ChatArea
                onBackMobile={() => {
                  setActiveChatId(null)
                  setActiveContactDrawerId(null)
                  setShowGroupInfo(false)
                }}
                onOpenGroupInfo={() => {
                  setActiveContactDrawerId(null)
                  setShowGroupInfo(true)
                }}
                onOpenContactDetails={
                  activeChatId && !activeChatId.startsWith('conv-group-')
                    ? (contactId) => {
                        setShowGroupInfo(false)
                        setActiveContactDrawerId(contactId)
                      }
                    : undefined
                }
              />

              {/* Group details right-dock panel — no mobile ocupa a tela como overlay deslizante */}
              {showGroupInfo && activeChatId && (
                <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-20 flex justify-end bg-black/60 md:bg-transparent animate-fade-in">
                  <GroupInfoPanel
                    conversationId={activeChatId}
                    onClose={() => setShowGroupInfo(false)}
                  />
                </div>
              )}

              {/* Drawer lateral de detalhes do contato clicado no header do chat — no mobile overlay full-screen */}
              {activeContactDrawerId && (
                <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-20 flex justify-end bg-black/60 md:bg-transparent animate-fade-in">
                  <ContactDetailsDrawer
                    contactId={activeContactDrawerId}
                    onClose={() => setActiveContactDrawerId(null)}
                    onOpenFullscreenAvatar={(media) => setActiveMedia(media)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de detalhes do contato (a partir de diálogos ou listas modais) */}
      <ContactDetailsModal
        contact={modalContact}
        onClose={() => setModalContactId(null)}
        onOpenChat={openChatWithContact}
      />

      {/* Fullscreen Media Viewer Modal */}
      {activeMedia && <MediaViewerModal media={activeMedia} onClose={() => setActiveMedia(null)} />}

      {/* Modal de Novo Contato acionado pelo FAB mobile */}
      <NewContactDialog
        open={fabNewContactOpen}
        onOpenChange={setFabNewContactOpen}
        onContactCreated={(created) => setModalContactId(created.id)}
      />

      {/* Modal de Gerenciamento de Etiquetas acionado pelo FAB mobile */}
      <LabelsManagerDialog open={fabLabelsOpen} onOpenChange={setFabLabelsOpen} />

      {/* Modal de Criação e Conexão de Instâncias WhatsApp via Evolution API */}
      <NewInstanceDialog open={newInstanceOpen} onOpenChange={setNewInstanceOpen} />

      {/* FAB Flutuante redondo estilo WhatsApp no mobile com menu bolha (apenas fora do chat ativo) */}
      {!activeChatId && (
        <SystemFabMenu
          onNewChat={() => setActiveLeftPanel('contacts')}
          onNewGroup={() => setActiveLeftPanel('new-group')}
          onNewContact={() => setFabNewContactOpen(true)}
          onNewLabel={() => setFabLabelsOpen(true)}
        />
      )}
    </div>
  )
}
