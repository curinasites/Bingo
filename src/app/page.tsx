'use client'

import { useBingoStore } from '@/store/bingo-store'
import LoginPage from '@/components/LoginPage'
import LobbyPage from '@/components/LobbyPage'
import GameRoom from '@/components/GameRoom'
import AdminPanel from '@/components/AdminPanel'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { view, setUser, setView } = useBingoStore()
  const [checking, setChecking] = useState(true)

  // Auto-login: check if there's a stored token
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('bingo_token')
      if (!token) {
        setChecking(false)
        return
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          setUser({
            id: data.user.id,
            email: data.user.email,
            nome: data.user.name || 'Jogador',
            saldo: data.saldo ?? 0,
            isAdmin: data.isAdmin ?? false,
          })
          // Keep current view (default to lobby if just logged in)
          if (view === 'login') {
            setView(data.isAdmin ? 'admin' : 'lobby')
          }
        } else {
          // Token invalid, clear it
          localStorage.removeItem('bingo_token')
        }
      } catch {
        // Network error, ignore
      } finally {
        setChecking(false)
      }
    }

    checkSession()
  }, [])

  // Loading state while checking session
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a1a' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-10 animate-spin text-bingo-green" />
          <p className="text-muted-foreground text-sm">Carregando Bingo Auto...</p>
        </div>
      </div>
    )
  }

  // Render view based on store state
  switch (view) {
    case 'login':
      return <LoginPage />
    case 'lobby':
      return <LobbyPage />
    case 'game':
      return <GameRoom />
    case 'admin':
      return <AdminPanel />
    default:
      return <LoginPage />
  }
}
