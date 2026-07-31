import { useSyncExternalStore } from 'react'

export type AppRoute =
  | { name: 'home' }
  | { name: 'chat'; sessionId: string }

const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', notifyListeners)
}

function getPathname(): string {
  return window.location.pathname
}

export function parseRoute(pathname: string): AppRoute {
  if (pathname === '/' || pathname === '') {
    return { name: 'home' }
  }
  const match = pathname.match(/^\/chat\/session=([^/]+)\/?$/)
  if (match) {
    try {
      const sessionId = decodeURIComponent(match[1])
      if (sessionId) {
        return { name: 'chat', sessionId }
      }
    } catch {
      // Invalid percent-encoding — fall through to home
    }
  }
  return { name: 'home' }
}

export function sessionPath(sessionId: string): string {
  return `/chat/session=${encodeURIComponent(sessionId)}`
}

export function navigate(path: string, replace = false): void {
  if (getPathname() === path) return
  if (replace) {
    window.history.replaceState(null, '', path)
  } else {
    window.history.pushState(null, '', path)
  }
  notifyListeners()
}

let cachedPathname = ''
let cachedRoute: AppRoute = { name: 'home' }

function getSnapshot(): AppRoute {
  const pathname = getPathname()
  if (pathname !== cachedPathname) {
    cachedPathname = pathname
    cachedRoute = parseRoute(pathname)
  }
  return cachedRoute
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRoute(): AppRoute {
  return useSyncExternalStore(subscribe, getSnapshot)
}
