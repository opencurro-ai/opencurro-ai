import { useEffect } from 'react'

import { navigate, useRoute } from '@/lib/router'
import { ChatPage } from '@/pages/ChatPage'
import { HomePage } from '@/pages/HomePage'

function App() {
  const route = useRoute()

  useEffect(() => {
    if (route.name === 'chat') {
      document.title = 'Curro AI — Chat'
      return
    }
    document.title = 'Curro AI'
    if (window.location.pathname !== '/') {
      navigate('/', true)
    }
  }, [route])

  if (route.name === 'chat') {
    return <ChatPage sessionId={route.sessionId} />
  }

  return <HomePage />
}

export default App
