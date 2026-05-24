'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useBingoStore } from '@/store/bingo-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Shield,
  Users,
  DoorOpen,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  DollarSign,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

// Types
interface AdminUser {
  carteira_id: number
  user_id: string
  email: string
  nome: string
  saldo: number
  updated_at: string
}

interface AdminRoom {
  id: number
  nome: string
  status: 'aguardando' | 'em_andamento' | 'finalizado'
  criador_id: string
  criador_nome?: string
  jogadores_count?: number
  created_at: string
}

interface AdminStats {
  total_users: number
  total_salas: number
  active_salas: number
}

// Particle background matching other pages
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
function StatusBadge({ status }: { status: AdminRoom['status'] }) {
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

export default function AdminPanel() {
  const { user, setView } = useBingoStore()

  // Data state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [stats, setStats] = useState<AdminStats>({ total_users: 0, total_salas: 0, active_salas: 0 })

  // UI state
  const [loadingData, setLoadingData] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roomSearch, setRoomSearch] = useState('')

  // Edit balance dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [newBalance, setNewBalance] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  // Delete room state
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null)

  // Admin guard - redirect non-admins
  useEffect(() => {
    if (user && !user.isAdmin) {
      setView('lobby')
    }
  }, [user, setView])

  // Fetch all admin data
  const fetchData = useCallback(async (showRefresh = false) => {
    const token = localStorage.getItem('bingo_token')
    if (!token) {
      toast.error('Sessão expirada. Faça login novamente.')
      setView('login')
      return
    }

    if (showRefresh) setRefreshing(true)
    try {
      const [adminRes, salasRes] = await Promise.all([
        fetch('/api/admin', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/salas'),
      ])

      if (adminRes.ok) {
        const adminData = await adminRes.json()
        setUsers(adminData.users ?? [])
        setStats(adminData.stats ?? { total_users: 0, total_salas: 0, active_salas: 0 })
      } else if (adminRes.status === 403) {
        toast.error('Acesso negado. Apenas administradores.')
        setView('lobby')
        return
      }

      if (salasRes.ok) {
        const salasData = await salasRes.json()
        setRooms(Array.isArray(salasData) ? salasData : (salasData.salas ?? []))
      }
    } catch {
      if (!showRefresh) {
        toast.error('Erro ao carregar dados do painel.')
      }
    } finally {
      setLoadingData(false)
      setRefreshing(false)
    }
  }, [setView])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Update balance
  const handleUpdateBalance = useCallback(async () => {
    if (!editingUser) return

    const balance = parseFloat(newBalance)
    if (isNaN(balance) || balance < 0) {
      toast.error('Informe um valor válido e não negativo.')
      return
    }

    const token = localStorage.getItem('bingo_token')
    if (!token) {
      toast.error('Sessão expirada. Faça login novamente.')
      setView('login')
      return
    }

    setSavingBalance(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: editingUser.user_id, saldo: balance }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao atualizar saldo.')
        return
      }

      toast.success(`Saldo de ${editingUser.nome} atualizado para R$ ${balance.toFixed(2)}`)
      setEditDialogOpen(false)
      setEditingUser(null)
      setNewBalance('')
      fetchData()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setSavingBalance(false)
    }
  }, [editingUser, newBalance, fetchData, setView])

  // Delete room
  const handleDeleteRoom = useCallback(async (roomId: number) => {
    const token = localStorage.getItem('bingo_token')
    if (!token) {
      toast.error('Sessão expirada. Faça login novamente.')
      setView('login')
      return
    }

    setDeletingRoomId(roomId)
    try {
      const res = await fetch('/api/admin', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sala_id: roomId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir sala.')
        return
      }

      toast.success(data.message || 'Sala excluída com sucesso!')
      fetchData()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setDeletingRoomId(null)
    }
  }, [fetchData, setView])

  // Open edit dialog
  const openEditDialog = useCallback((u: AdminUser) => {
    setEditingUser(u)
    setNewBalance(u.saldo.toFixed(2))
    setEditDialogOpen(true)
  }, [])

  // Filter users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const search = userSearch.toLowerCase()
    return users.filter(
      (u) =>
        u.nome.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
    )
  }, [users, userSearch])

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (!roomSearch.trim()) return rooms
    const search = roomSearch.toLowerCase()
    return rooms.filter(
      (r) =>
        r.nome.toLowerCase().includes(search) ||
        (r.criador_nome ?? '').toLowerCase().includes(search) ||
        r.status.toLowerCase().includes(search)
    )
  }, [rooms, roomSearch])

  // Not admin - don't render the panel
  if (!user?.isAdmin) {
    return null
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a1a' }}>
      {/* Particle background */}
      <ParticleBackground />

      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-bingo-green/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-bingo-gold/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      {/* Header */}
      <header className="relative z-10 glass-strong border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Back button */}
          <Button
            onClick={() => setView('lobby')}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-9 px-2.5"
            aria-label="Voltar ao lobby"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline ml-1.5">Voltar</span>
          </Button>

          {/* Title */}
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-wider">
            PAINEL ADMINISTRATIVO
          </h1>

          {/* Admin badge */}
          <div className="flex items-center gap-1.5 bg-bingo-gold/10 border border-bingo-gold/20 rounded-lg px-3 py-1.5">
            <Shield className="size-4 text-bingo-gold" />
            <span className="text-bingo-gold font-bold text-sm hidden sm:inline">Admin</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bingo-green/10 flex items-center justify-center flex-shrink-0">
              <Users className="size-6 text-bingo-green" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Usuários</p>
              <p className="text-foreground text-2xl font-bold">{stats.total_users}</p>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bingo-gold/10 flex items-center justify-center flex-shrink-0">
              <DoorOpen className="size-6 text-bingo-gold" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Salas Totais</p>
              <p className="text-foreground text-2xl font-bold">{stats.total_salas}</p>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bingo-green/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="size-6 text-bingo-green" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Salas Ativas</p>
              <p className="text-foreground text-2xl font-bold">{stats.active_salas}</p>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-9 px-3"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 text-sm">Atualizar</span>
          </Button>
        </div>

        {loadingData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-bingo-green" />
              <p className="text-muted-foreground text-sm">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Users Management Section */}
            <section className="glass-card rounded-xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-bingo-green" />
                  <h2 className="text-lg font-bold text-foreground">Gerenciamento de Usuários</h2>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-9 pl-9 text-sm"
                  />
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    {userSearch ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Nome</TableHead>
                        <TableHead className="text-muted-foreground hidden sm:table-cell">Email</TableHead>
                        <TableHead className="text-muted-foreground">Saldo</TableHead>
                        <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.user_id} className="border-white/5 hover:bg-white/5">
                          <TableCell className="font-medium text-foreground">
                            {u.nome}
                            <span className="block sm:hidden text-xs text-muted-foreground mt-0.5">{u.email}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">{u.email}</TableCell>
                          <TableCell>
                            <span className="text-bingo-gold font-semibold">
                              R$ {u.saldo.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(u)}
                              className="text-bingo-green hover:text-bingo-green hover:bg-bingo-green/10 h-8 px-2"
                              aria-label={`Editar saldo de ${u.nome}`}
                            >
                              <Edit className="size-4" />
                              <span className="hidden sm:inline ml-1">Editar</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Rooms Management Section */}
            <section className="glass-card rounded-xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <DoorOpen className="size-5 text-bingo-gold" />
                  <h2 className="text-lg font-bold text-foreground">Gerenciamento de Salas</h2>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou criador..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-9 pl-9 text-sm"
                  />
                </div>
              </div>

              {filteredRooms.length === 0 ? (
                <div className="text-center py-8">
                  <DoorOpen className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    {roomSearch ? 'Nenhuma sala encontrada.' : 'Nenhuma sala criada.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Nome</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground hidden md:table-cell">Criador</TableHead>
                        <TableHead className="text-muted-foreground hidden sm:table-cell">Jogadores</TableHead>
                        <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRooms.map((r) => (
                        <TableRow key={r.id} className="border-white/5 hover:bg-white/5">
                          <TableCell className="font-medium text-foreground">{r.nome}</TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">
                            {r.criador_nome ?? 'Desconhecido'}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <Users className="size-3.5" />
                              <span>{r.jogadores_count ?? 0}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={deletingRoomId === r.id}
                                  className="text-bingo-red hover:text-bingo-red hover:bg-bingo-red/10 h-8 px-2"
                                  aria-label={`Excluir sala ${r.nome}`}
                                >
                                  {deletingRoomId === r.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4" />
                                  )}
                                  <span className="hidden sm:inline ml-1">Excluir</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass-strong border-bingo-red/20">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-foreground">
                                    Confirmar Exclusão
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-muted-foreground">
                                    Tem certeza que deseja excluir a sala <strong className="text-foreground">{r.nome}</strong>?
                                    Esta ação não pode ser desfeita. Todos os dados da sala (cartelas e sorteios) serão perdidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="text-muted-foreground hover:text-foreground">
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteRoom(r.id)}
                                    className="bg-bingo-red hover:bg-bingo-red/90 text-white font-semibold rounded-lg"
                                  >
                                    Excluir Sala
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 glass-strong border-t border-white/5 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 text-center">
          <p className="text-muted-foreground text-xs">
            Bingo Auto &copy; {new Date().getFullYear()} — Painel Administrativo
          </p>
        </div>
      </footer>

      {/* Edit Balance Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-strong border-bingo-green/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Editar Saldo</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Altere o saldo do usuário <strong className="text-foreground">{editingUser?.nome}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-balance" className="text-foreground">
                Novo Saldo (R$)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-bingo-gold" />
                <Input
                  id="edit-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11 pl-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-bingo-gold/10 border border-bingo-gold/20 rounded-lg p-3">
              <DollarSign className="size-4 text-bingo-gold flex-shrink-0" />
              <span className="text-sm text-bingo-gold">
                Saldo atual: <strong>R$ {editingUser?.saldo.toFixed(2) ?? '0.00'}</strong>
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingUser(null)
                setNewBalance('')
              }}
              className="text-muted-foreground hover:text-foreground"
              disabled={savingBalance}
            >
              <X className="size-4 mr-1" />
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateBalance}
              disabled={savingBalance}
              className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25 min-w-[120px]"
            >
              {savingBalance ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
