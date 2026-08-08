import { useEffect } from 'react'

import { navigate, useRoute } from '@/lib/router'
import { ChatPage } from '@/pages/ChatPage'
import { HomePage } from '@/pages/HomePage'
import { SubAgentsPage } from '@/pages/SubAgentsPage'

function App() {
  const route = useRoute()

  useEffect(() => {
    if (route.name === 'chat') {
      document.title = 'Curro AI — Chat'
      return
    }
    if (route.name === 'sub-agents') {
      document.title = 'Curro AI — Sub-Agents'
      return
    }
    document.title = 'Curro AI'
    if (window.location.pathname !== '/') {
      navigate('/', true)
    }
  }, [route])

  if (route.name === 'chat') {
    return <ChatPage />
  }

  if (route.name === 'sub-agents') {
    return <SubAgentsPage />
  }

  return <HomePage />
}

export default App
