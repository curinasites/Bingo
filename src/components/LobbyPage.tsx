'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useBingoStore } from '@/store/bingo-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Plus,
  Users,
  LogOut,
  DollarSign,
  Shield,
  RefreshCw,
  Loader2,
  Gamepad2,
  Eye,
  DoorOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Sala } from '@/lib/supabase'

// Particle component for floating bingo numbers (same as LoginPage)
function ParticleBackground() {
  const particles = useMemo(() => {
    const items = []
    for (let i = 0; i < 35; i++) {
      const num = Math.floor(Math.random() * 75) + 1
      items.push({
        id: i,
        number: num,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 16 + 12,
        duration: Math.random() * 12 + 10,
        delay: Math.random() * -20,
        opacity: Math.random() * 0.25 + 0.05,
      })
    }
    return items
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-bingo-green font-mono font-bold select-none"
          style={{
            left: p.left,
            top: p.top,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        >
          {p.number}
        </span>
      ))}
    </div>
  )
}

// Status badge helper
function StatusBadge({ status }: { status: Sala['status'] }) {
  switch (status) {
    case 'aguardando':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30">
          Aguardando
        </Badge>
      )
    case 'em_andamento':
      return (
        <Badge className="bg-bingo-green/20 text-bingo-green border-bingo-green/30 hover:bg-bingo-green/30">
          Em Andamento
        </Badge>
      )
    case 'finalizado':
      return (
        <Badge className="bg-bingo-red/20 text-bingo-red border-bingo-red/30 hover:bg-bingo-red/30">
          Finalizado
        </Badge>
      )
    default:
      return null
  }
}

// Room card component
function RoomCard({
  room,
  onJoin,
  joiningRoomId,
}: {
  room: Sala
  onJoin: (roomId: number, status: Sala['status']) => void
  joiningRoomId: number | null
}) {
  const isJoining = joiningRoomId === room.id
  const isActionable = room.status === 'aguardando' || room.status === 'em_andamento'

  return (
    <div className="glass-card rounded-xl p-4 sm:p-5 transition-all hover:border-bingo-green/40 hover:shadow-lg hover:shadow-bingo-green/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Room info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-foreground truncate text-lg">
              {room.nome}
            </h3>
            <StatusBadge status={room.status} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span>{room.jogadores_count ?? 0} jogador(es)</span>
            </div>
            {room.criador_nome && (
              <div className="flex items-center gap-1.5 truncate">
                <DoorOpen className="size-3.5 flex-shrink-0" />
                <span className="truncate">{room.criador_nome}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="flex-shrink-0">
          {room.status === 'aguardando' && (
            <Button
              onClick={() => onJoin(room.id, room.status)}
              disabled={isJoining}
              className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25 h-10 px-5"
            >
              {isJoining ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Gamepad2 className="size-4" />
                  Entrar
                </>
              )}
            </Button>
          )}
          {room.status === 'em_andamento' && (
            <Button
              onClick={() => onJoin(room.id, room.status)}
              disabled={isJoining}
              variant="outline"
              className="border-bingo-green/40 text-bingo-green hover:bg-bingo-green/10 font-semibold rounded-lg transition-all h-10 px-5"
            >
              {isJoining ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Eye className="size-4" />
                  Assistir
                </>
              )}
            </Button>
          )}
          {room.status === 'finalizado' && (
            <Button disabled variant="ghost" className="text-muted-foreground/50 rounded-lg h-10 px-5">
              Finalizado
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LobbyPage() {
  const { user, setUser, setView, setCurrentSalaId } = useBingoStore()

  // State
  const [rooms, setRooms] = useState<Sala[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<number | null>(null)

  // Fetch rooms
  const fetchRooms = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/salas')
      if (res.ok) {
        const data = await res.json()
        setRooms(Array.isArray(data) ? data : [])
      }
    } catch {
      // Silent fail for polling
    } finally {
      setLoadingRooms(false)
      setRefreshing(false)
    }
  }, [])

  // Refresh user balance
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('bingo_token')
    if (!token) return

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (user) {
          setUser({
            ...user,
            saldo: data.saldo ?? user.saldo,
          })
        }
      }
    } catch {
      // Silent fail
    }
  }, [user, setUser])

  // Initial fetch + polling
  useEffect(() => {
    fetchRooms()
    const interval = setInterval(() => fetchRooms(), 5000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  // Refresh user data periodically
  useEffect(() => {
    refreshUser()
    const interval = setInterval(refreshUser, 15000)
    return () => clearInterval(interval)
  }, [refreshUser])

  // Create room
  const handleCreateRoom = useCallback(async () => {
    if (!roomName.trim()) {
      toast.error('Digite um nome para a sala.')
      return
    }

    if (user && user.saldo < 1) {
      toast.error('Saldo insuficiente. Você precisa de R$ 1,00 para criar uma sala.')
      return
    }

    const token = localStorage.getItem('bingo_token')
    if (!token) {
      toast.error('Sessão expirada. Faça login novamente.')
      setView('login')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/salas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome: roomName.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar sala.')
        return
      }

      toast.success('Sala criada com sucesso!')

      // Auto-join the created room and navigate to game
      setCurrentSalaId(data.sala?.id ?? data.id)
      setView('game')
      setCreateDialogOpen(false)
      setRoomName('')

      // Refresh balance
      refreshUser()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }, [roomName, user, setView, setCurrentSalaId, refreshUser])

  // Join room
  const handleJoinRoom = useCallback(async (roomId: number, status: Sala['status']) => {
    if (status === 'aguardando' && user && user.saldo < 1) {
      toast.error('Saldo insuficiente. Você precisa de R$ 1,00 para entrar na sala.')
      return
    }

    const token = localStorage.getItem('bingo_token')
    if (!token) {
      toast.error('Sessão expirada. Faça login novamente.')
      setView('login')
      return
    }

    setJoiningRoomId(roomId)
    try {
      if (status === 'aguardando') {
        const res = await fetch(`/api/salas/${roomId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error || 'Erro ao entrar na sala.')
          return
        }

        toast.success('Você entrou na sala!')
      }

      setCurrentSalaId(roomId)
      setView('game')

      // Refresh balance
      refreshUser()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setJoiningRoomId(null)
    }
  }, [user, setView, setCurrentSalaId, refreshUser])

  // Logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem('bingo_token')
    setUser(null)
    setView('login')
    toast.success('Logout realizado com sucesso.')
  }, [setUser, setView])

  // Admin navigation
  const handleAdmin = useCallback(() => {
    setView('admin')
  }, [setView])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a1a' }}>
      {/* Particle background */}
      <ParticleBackground />

      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-bingo-green/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-bingo-gold/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      {/* Header */}
      <header className="relative z-10 glass-strong border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Logo */}
          <h1 className="text-xl sm:text-2xl font-extrabold gradient-text tracking-wider flex-shrink-0">
            BINGO AUTO
          </h1>

          {/* User info */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* User name - hidden on small screens */}
            <span className="text-sm text-muted-foreground font-medium hidden sm:block truncate max-w-[150px]">
              {user?.nome}
            </span>

            {/* Balance */}
            <div className="flex items-center gap-1.5 bg-bingo-gold/10 border border-bingo-gold/20 rounded-lg px-3 py-1.5">
              <DollarSign className="size-4 text-bingo-gold" />
              <span className="text-bingo-gold font-bold text-sm whitespace-nowrap">
                R$ {(user?.saldo ?? 0).toFixed(2)}
              </span>
            </div>

            {/* Admin button */}
            {user?.isAdmin && (
              <Button
                onClick={handleAdmin}
                variant="ghost"
                size="sm"
                className="text-bingo-gold hover:text-bingo-gold hover:bg-bingo-gold/10 h-9 px-2.5"
                aria-label="Painel Admin"
              >
                <Shield className="size-4" />
                <span className="hidden sm:inline ml-1.5">Admin</span>
              </Button>
            )}

            {/* Logout */}
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 px-2.5"
              aria-label="Sair"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline ml-1.5">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col">
        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Salas de Bingo
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Escolha uma sala para jogar ou crie a sua
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchRooms(true)}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-10 px-3"
              aria-label="Atualizar salas"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            {/* Create room dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25 h-10 px-5">
                  <Plus className="size-4" />
                  Criar Sala
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-strong border-bingo-green/20 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-foreground text-xl">Criar Nova Sala</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Crie sua sala e convide outros jogadores!
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label htmlFor="room-name" className="text-sm font-medium text-foreground">
                      Nome da Sala
                    </label>
                    <Input
                      id="room-name"
                      placeholder="Ex: Bingo da Galera"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !creating) handleCreateRoom()
                      }}
                      className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11"
                      maxLength={50}
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-bingo-gold/10 border border-bingo-gold/20 rounded-lg p-3">
                    <DollarSign className="size-4 text-bingo-gold flex-shrink-0" />
                    <span className="text-sm text-bingo-gold">
                      Taxa de criação: <strong>R$ 1,00</strong>
                    </span>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setCreateDialogOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={creating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={creating || !roomName.trim()}
                    className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25 min-w-[120px]"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Criar
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Rooms list */}
        {loadingRooms ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-bingo-green" />
              <p className="text-muted-foreground text-sm">Carregando salas...</p>
            </div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="glass-card rounded-2xl p-8 sm:p-12 text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bingo-green/10 flex items-center justify-center">
                <Gamepad2 className="size-8 text-bingo-green" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma sala disponível
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Seja o primeiro a criar uma sala e comece a jogar!
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25"
              >
                <Plus className="size-4" />
                Criar Sala
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-3 pb-4">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onJoin={handleJoinRoom}
                  joiningRoomId={joiningRoomId}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 glass-strong border-t border-white/5 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 text-center">
          <p className="text-muted-foreground text-xs">
            Bingo Auto &copy; {new Date().getFullYear()} — Jogue com responsabilidade
          </p>
        </div>
      </footer>
    </div>
  )
}
