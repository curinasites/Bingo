'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useBingoStore } from '@/store/bingo-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Trophy,
  Star,
  Volume2,
  Loader2,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

// --- Types ---
interface CartelaData {
  id: number
  sala_id: number
  jogador_id: string
  numeros: number[][]
  created_at: string
}

interface SalaData {
  id: number
  nome: string
  status: 'aguardando' | 'em_andamento' | 'finalizado'
  criador_id: string
  criador_nome: string
  jogadores_count: number
  sorteios_count: number
}

// --- Helpers ---
function getBallLetter(num: number): string {
  if (num >= 1 && num <= 15) return 'B'
  if (num >= 16 && num <= 30) return 'I'
  if (num >= 31 && num <= 45) return 'N'
  if (num >= 46 && num <= 60) return 'G'
  if (num >= 61 && num <= 75) return 'O'
  return ''
}

function getLetterColor(letter: string): string {
  switch (letter) {
    case 'B': return 'bg-blue-500/80'
    case 'I': return 'bg-red-500/80'
    case 'N': return 'bg-bingo-green/80'
    case 'G': return 'bg-yellow-500/80'
    case 'O': return 'bg-purple-500/80'
    default: return 'bg-bingo-green/80'
  }
}

function isSpecialBall(num: number): boolean {
  // Gold ball for multiples of 10 or 7
  return num % 10 === 0 || num === 7
}

// --- Sound Effect ---
const playBallSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.3)
  } catch {
    // Audio not available
  }
}

const playWinSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.4)
      osc.start(audioCtx.currentTime + i * 0.15)
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.4)
    })
  } catch {
    // Audio not available
  }
}

// --- Confetti Component ---
function ConfettiOverlay() {
  const pieces = useMemo(() => {
    const items = []
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
    for (let i = 0; i < 60; i++) {
      items.push({
        id: i,
        left: `${Math.random() * 100}%`,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        duration: Math.random() * 2 + 2,
        delay: Math.random() * 1.5,
      })
    }
    return items
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece absolute"
          style={{
            left: p.left,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// --- Status Badge ---
function GameStatusBadge({ status }: { status: SalaData['status'] }) {
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

// --- Bingo Card Component ---
function BingoCard({
  cardIndex,
  card,
  cardId,
  drawnNumbers,
  markedSet,
  onToggleMark,
}: {
  cardIndex: number
  card: number[][]
  cardId: number
  drawnNumbers: Set<number>
  markedSet: Set<number>
  onToggleMark: (cardIndex: number, num: number) => void
}) {
  const letters = ['B', 'I', 'N', 'G', 'O']

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Card header with B I N G O */}
      <div className="grid grid-cols-5 bg-bingo-green/20 border-b border-bingo-green/20">
        {letters.map((letter) => (
          <div
            key={letter}
            className="py-2 text-center font-bold text-bingo-green text-sm sm:text-base"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-5 gap-px bg-white/5">
        {card.map((row, rowIdx) =>
          row.map((num, colIdx) => {
            const isFree = num === 0
            const isDrawn = !isFree && drawnNumbers.has(num)
            const isMarked = isFree || markedSet.has(num)
            const isDrawnButNotMarked = isDrawn && !isMarked

            return (
              <button
                key={`${rowIdx}-${colIdx}`}
                onClick={() => {
                  if (!isFree && isDrawn) {
                    onToggleMark(cardIndex, num)
                  }
                }}
                disabled={!isDrawn || isFree}
                className={`
                  relative aspect-square flex items-center justify-center
                  text-xs sm:text-sm font-bold transition-all duration-200
                  ${isFree
                    ? 'bg-bingo-gold/20 text-bingo-gold cursor-default'
                    : isMarked
                      ? 'bg-bingo-green/30 text-white mark-animate cursor-pointer hover:bg-bingo-green/40'
                      : isDrawnButNotMarked
                        ? 'bg-white/5 text-foreground cursor-pointer hover:bg-bingo-green/20'
                        : 'bg-white/5 text-muted-foreground/60 cursor-default'
                  }
                `}
                aria-label={isFree ? 'Espaço livre' : `${getBallLetter(num)}${num}`}
              >
                {isFree ? (
                  <Star className="size-3 sm:size-4 fill-bingo-gold" />
                ) : (
                  <span>{num}</span>
                )}
                {/* Dot indicator for drawn but not marked */}
                {isDrawnButNotMarked && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-bingo-green pulse-glow" />
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Card ID footer */}
      <div className="px-2 py-1 text-center text-[10px] text-muted-foreground/50 border-t border-white/5">
        Cartela #{cardId}
      </div>
    </div>
  )
}

// --- Drawn Numbers Grid ---
function DrawnNumbersGrid({ drawnNumbers }: { drawnNumbers: number[] }) {
  const columns: Record<string, number[]> = { B: [], I: [], N: [], G: [], O: [] }

  drawnNumbers.forEach((num) => {
    const letter = getBallLetter(num)
    if (letter && columns[letter]) {
      columns[letter].push(num)
    }
  })

  const latestNum = drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null

  return (
    <div className="space-y-2">
      {['B', 'I', 'N', 'G', 'O'].map((letter) => (
        <div key={letter} className="flex items-start gap-1.5">
          <span
            className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0 ${getLetterColor(letter)}`}
          >
            {letter}
          </span>
          <div className="flex flex-wrap gap-1">
            {columns[letter].length === 0 ? (
              <span className="text-muted-foreground/30 text-xs">—</span>
            ) : (
              columns[letter].map((num) => (
                <span
                  key={num}
                  className={`
                    inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                    ${num === latestNum
                      ? 'bg-bingo-green text-white pulse-glow'
                      : 'bg-white/10 text-muted-foreground'
                    }
                  `}
                >
                  {num}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Main Component ---
export default function GameRoom() {
  const {
    user,
    currentSalaId,
    setUser,
    setView,
    setCurrentSalaId,
    drawnNumbers,
    setDrawnNumbers,
    addDrawnNumber,
    gameStatus,
    setGameStatus,
    winner,
    setWinner,
    currentBall,
    setCurrentBall,
    cartelas,
    setCartelas,
    markedNumbers,
    toggleMark,
    resetGame,
  } = useBingoStore()

  // Local state
  const [sala, setSala] = useState<SalaData | null>(null)
  const [cartelaData, setCartelaData] = useState<CartelaData[]>([])
  const [loading, setLoading] = useState(true)
  const [startingGame, setStartingGame] = useState(false)
  const [buyingCard, setBuyingCard] = useState(false)
  const [claimingBingo, setClaimingBingo] = useState(false)
  const [showWinDialog, setShowWinDialog] = useState(false)
  const [winData, setWinData] = useState<{
    nome: string
    premio: number
    isSelf: boolean
  } | null>(null)
  const [ballAnimating, setBallAnimating] = useState(false)
  const [prize, setPrize] = useState(0)

  // Refs for intervals
  const drawIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roomPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // Derived
  const isCreator = user?.id === sala?.criador_id
  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers])

  // --- API Helpers ---
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('bingo_token')
    if (!token) {
      toast.error('Sessão expirada. Faça login novamente.')
      setView('login')
      return null
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }, [setView])

  // --- Fetch room details ---
  const fetchRoom = useCallback(async () => {
    if (!currentSalaId) return
    try {
      const res = await fetch(`/api/salas/${currentSalaId}`)
      if (res.ok) {
        const data = await res.json()
        if (mountedRef.current && data.sala) {
          setSala(data.sala)
          setGameStatus(data.sala.status)

          // Calculate prize estimate
          const estimatedPrize = data.sala.jogadores_count * 0.5
          setPrize(estimatedPrize)

          // If game was finalized and we don't have winner yet, check
          if (data.sala.status === 'finalizado' && !winner) {
            // The game ended - someone won
            setGameStatus('finalizado')
          }
        }
      }
    } catch {
      // Silent
    }
  }, [currentSalaId, setGameStatus, winner])

  // --- Fetch player's cards ---
  const fetchCards = useCallback(async () => {
    if (!currentSalaId) return
    const headers = getAuthHeaders()
    if (!headers) return

    try {
      const res = await fetch(`/api/cartelas?sala_id=${currentSalaId}`, { headers })
      if (res.ok) {
        const data = await res.json()
        if (mountedRef.current && data.cartelas) {
          setCartelaData(data.cartelas)
          setCartelas(data.cartelas.map((c: CartelaData) => c.numeros))
        }
      }
    } catch {
      // Silent
    }
  }, [currentSalaId, getAuthHeaders, setCartelas])

  // --- Fetch drawn numbers ---
  const fetchDrawnNumbers = useCallback(async () => {
    if (!currentSalaId) return
    try {
      const res = await fetch(`/api/sorteios?sala_id=${currentSalaId}`)
      if (res.ok) {
        const data = await res.json()
        if (mountedRef.current && data.sorteios) {
          const numbers = data.sorteios.map((s: { numero: number }) => s.numero)
          setDrawnNumbers(numbers)

          // Set current ball to last drawn
          if (numbers.length > 0) {
            const lastNum = numbers[numbers.length - 1]
            if (currentBall !== lastNum) {
              setCurrentBall(lastNum)
            }
          }
        }
      }
    } catch {
      // Silent
    }
  }, [currentSalaId, setDrawnNumbers, currentBall, setCurrentBall])

  // --- Refresh user balance ---
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('bingo_token')
    if (!token) return
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (user && mountedRef.current) {
          setUser({ ...user, saldo: data.saldo ?? user.saldo })
        }
      }
    } catch {
      // Silent
    }
  }, [user, setUser])

  // --- Draw a number (creator only) ---
  const drawNumber = useCallback(async () => {
    if (!currentSalaId) return
    const headers = getAuthHeaders()
    if (!headers) return

    try {
      const res = await fetch('/api/sorteios', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sala_id: currentSalaId }),
      })

      const data = await res.json()

      if (!res.ok) {
        // If all numbers drawn, stop
        if (data.error?.includes('já foram sorteados')) {
          if (drawIntervalRef.current) {
            clearInterval(drawIntervalRef.current)
            drawIntervalRef.current = null
          }
        }
        return
      }

      if (data.sorteio && mountedRef.current) {
        const num = data.sorteio.numero
        addDrawnNumber(num)
        setCurrentBall(num)
        playBallSound()

        // Animate ball
        setBallAnimating(true)
        setTimeout(() => {
          if (mountedRef.current) setBallAnimating(false)
        }, 1000)
      }
    } catch {
      // Silent
    }
  }, [currentSalaId, getAuthHeaders, addDrawnNumber, setCurrentBall])

  // --- Poll for new draws (non-creator) ---
  const pollDraws = useCallback(async () => {
    if (!currentSalaId) return
    try {
      const res = await fetch(`/api/sorteios?sala_id=${currentSalaId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.sorteios && mountedRef.current) {
          const numbers = data.sorteios.map((s: { numero: number }) => s.numero)

          // Check for new numbers
          if (numbers.length > drawnNumbers.length) {
            const newNumbers = numbers.slice(drawnNumbers.length)
            setDrawnNumbers(numbers)

            // Animate the latest ball
            const latestNum = numbers[numbers.length - 1]
            setCurrentBall(latestNum)
            playBallSound()

            setBallAnimating(true)
            setTimeout(() => {
              if (mountedRef.current) setBallAnimating(false)
            }, 1000)
          }
        }
      }
    } catch {
      // Silent
    }
  }, [currentSalaId, drawnNumbers, setDrawnNumbers, setCurrentBall])

  // --- Poll for room status changes ---
  const pollRoomStatus = useCallback(async () => {
    if (!currentSalaId) return
    try {
      const res = await fetch(`/api/salas/${currentSalaId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.sala && mountedRef.current) {
          setSala(data.sala)

          if (data.sala.status !== gameStatus) {
            setGameStatus(data.sala.status)
          }

          // Update prize
          setPrize(data.sala.jogadores_count * 0.5)

          // If game is finalized
          if (data.sala.status === 'finalizado' && gameStatus !== 'finalizado') {
            // Someone won - we need to find out who
            setWinner('vencedor')
            setGameStatus('finalizado')
          }
        }
      }
    } catch {
      // Silent
    }
  }, [currentSalaId, gameStatus, setGameStatus, setWinner])

  // --- Start game ---
  const handleStartGame = useCallback(async () => {
    if (!currentSalaId) return
    const headers = getAuthHeaders()
    if (!headers) return

    setStartingGame(true)
    try {
      const res = await fetch(`/api/salas/${currentSalaId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'em_andamento' }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao iniciar o jogo.')
        return
      }

      toast.success('Jogo iniciado! Os números serão sorteados automaticamente.')
      setGameStatus('em_andamento')
      if (data.sala) setSala(data.sala)
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setStartingGame(false)
    }
  }, [currentSalaId, getAuthHeaders, setGameStatus])

  // --- Buy extra card ---
  const handleBuyCard = useCallback(async () => {
    if (!currentSalaId) return
    const headers = getAuthHeaders()
    if (!headers) return

    if (user && user.saldo < 2) {
      toast.error('Saldo insuficiente. Você precisa de R$ 2,00 para comprar uma cartela extra.')
      return
    }

    setBuyingCard(true)
    try {
      const res = await fetch('/api/cartelas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sala_id: currentSalaId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao comprar cartela.')
        return
      }

      toast.success('Cartela extra comprada com sucesso!')
      await fetchCards()
      await refreshUser()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setBuyingCard(false)
    }
  }, [currentSalaId, getAuthHeaders, user, fetchCards, refreshUser])

  // --- Claim BINGO ---
  const handleClaimBingo = useCallback(async (cartelaId: number) => {
    if (!currentSalaId) return
    const headers = getAuthHeaders()
    if (!headers) return

    setClaimingBingo(true)
    try {
      const res = await fetch('/api/bingo', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sala_id: currentSalaId, cartela_id: cartelaId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Bingo inválido!')
        return
      }

      // BINGO valid!
      playWinSound()
      setGameStatus('finalizado')
      setWinner(user?.nome ?? 'vencedor')
      setWinData({
        nome: data.vencedor?.nome || user?.nome || 'Você',
        premio: data.premio || 0,
        isSelf: true,
      })
      setShowWinDialog(true)

      // Refresh user balance (prize added)
      await refreshUser()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setClaimingBingo(false)
    }
  }, [currentSalaId, getAuthHeaders, setGameStatus, setWinner, user, refreshUser])

  // --- Toggle mark ---
  const handleToggleMark = useCallback((cardIndex: number, num: number) => {
    toggleMark(cardIndex, num)
  }, [toggleMark])

  // --- Leave room ---
  const handleLeaveRoom = useCallback(() => {
    // Clear all intervals
    if (drawIntervalRef.current) clearInterval(drawIntervalRef.current)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (roomPollRef.current) clearInterval(roomPollRef.current)
    drawIntervalRef.current = null
    pollIntervalRef.current = null
    roomPollRef.current = null

    resetGame()
    setView('lobby')
  }, [resetGame, setView])

  // --- Initial data load ---
  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      setLoading(true)
      await Promise.all([fetchRoom(), fetchCards(), fetchDrawnNumbers()])
      setLoading(false)
    }

    if (currentSalaId) {
      init()
    } else {
      setLoading(false)
    }

    return () => {
      mountedRef.current = false
    }
  }, [])

  // --- Auto-draw interval (creator) ---
  useEffect(() => {
    // Clear previous interval
    if (drawIntervalRef.current) {
      clearInterval(drawIntervalRef.current)
      drawIntervalRef.current = null
    }

    if (gameStatus === 'em_andamento' && isCreator && currentSalaId) {
      drawIntervalRef.current = setInterval(drawNumber, 3000)
    }

    return () => {
      if (drawIntervalRef.current) {
        clearInterval(drawIntervalRef.current)
        drawIntervalRef.current = null
      }
    }
  }, [gameStatus, isCreator, currentSalaId, drawNumber])

  // --- Poll interval (non-creator) ---
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    if (gameStatus === 'em_andamento' && !isCreator && currentSalaId) {
      // Poll immediately then every 2 seconds
      pollDraws()
      pollIntervalRef.current = setInterval(pollDraws, 2000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [gameStatus, isCreator, currentSalaId, pollDraws])

  // --- Room status polling (to detect game start/end) ---
  useEffect(() => {
    if (roomPollRef.current) {
      clearInterval(roomPollRef.current)
      roomPollRef.current = null
    }

    if (currentSalaId && gameStatus !== 'finalizado') {
      roomPollRef.current = setInterval(pollRoomStatus, 3000)
    }

    return () => {
      if (roomPollRef.current) {
        clearInterval(roomPollRef.current)
        roomPollRef.current = null
      }
    }
  }, [currentSalaId, gameStatus, pollRoomStatus])

  // --- Refresh user balance periodically ---
  useEffect(() => {
    const interval = setInterval(refreshUser, 15000)
    return () => clearInterval(interval)
  }, [refreshUser])

  // --- Render ---

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a1a' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-10 animate-spin text-bingo-green" />
          <p className="text-muted-foreground text-sm">Carregando sala...</p>
        </div>
      </div>
    )
  }

  // No room found
  if (!sala) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a1a' }}>
        <div className="glass-card rounded-2xl p-8 text-center max-w-md">
          <p className="text-muted-foreground mb-4">Sala não encontrada.</p>
          <Button
            onClick={handleLeaveRoom}
            className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg"
          >
            <ArrowLeft className="size-4" />
            Voltar ao Lobby
          </Button>
        </div>
      </div>
    )
  }

  const currentBallLetter = currentBall ? getBallLetter(currentBall) : ''
  const currentBallIsSpecial = currentBall ? isSpecialBall(currentBall) : false

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a1a' }}>
      {/* Header */}
      <header className="glass-strong border-b border-white/5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Back + Room info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeaveRoom}
              className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-9 w-9 p-0 flex-shrink-0"
              aria-label="Voltar ao lobby"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-foreground text-sm sm:text-lg truncate">
                  {sala.nome}
                </h1>
                <GameStatusBadge status={gameStatus} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-3" />
                <span>{sala.jogadores_count} jogador(es)</span>
              </div>
            </div>
          </div>

          {/* Right: Balance + Buy card */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-bingo-gold/10 border border-bingo-gold/20 rounded-lg px-2.5 py-1.5">
              <DollarSign className="size-3.5 text-bingo-gold" />
              <span className="text-bingo-gold font-bold text-xs sm:text-sm whitespace-nowrap">
                R$ {(user?.saldo ?? 0).toFixed(2)}
              </span>
            </div>
            {gameStatus === 'aguardando' && (
              <Button
                onClick={handleBuyCard}
                disabled={buyingCard}
                size="sm"
                className="bg-bingo-green/20 border border-bingo-green/30 text-bingo-green hover:bg-bingo-green/30 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
              >
                {buyingCard ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                <span className="hidden sm:inline ml-1">Comprar Cartela</span>
                <span className="sm:hidden ml-1">Cartela</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* Left: Cards area */}
        <div className="flex-1 lg:w-[70%] p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
          {/* Current Ball Area */}
          <div className="flex flex-col items-center justify-center py-4 sm:py-6">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
              {drawnNumbers.length > 0 ? 'Número Atual' : 'Aguardando sorteio...'}
            </div>

            {/* Ball */}
            <div className="relative">
              {currentBall ? (
                <div
                  className={`
                    w-20 h-20 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center
                    ${currentBallIsSpecial ? 'bingo-ball-gold' : 'bingo-ball-3d'}
                    ${ballAnimating ? 'ball-animate' : ''}
                    transition-all duration-300
                  `}
                >
                  <span className="text-[10px] sm:text-xs font-bold text-white/80 leading-none">
                    {currentBallLetter}
                  </span>
                  <span className="text-2xl sm:text-4xl font-extrabold text-white leading-none">
                    {currentBall}
                  </span>
                </div>
              ) : (
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
                  <span className="text-3xl sm:text-5xl text-muted-foreground/30 font-bold">—</span>
                </div>
              )}
            </div>

            {/* Draw counter + prize */}
            <div className="flex items-center gap-4 mt-3 text-xs sm:text-sm">
              <span className="text-muted-foreground">
                <Volume2 className="size-3 inline mr-1" />
                {drawnNumbers.length}/75 sorteados
              </span>
              <span className="text-bingo-gold font-semibold">
                <Trophy className="size-3 inline mr-1" />
                Prêmio: R$ {prize.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Start button (creator only) */}
          {gameStatus === 'aguardando' && isCreator && (
            <div className="flex justify-center pb-2">
              <Button
                onClick={handleStartGame}
                disabled={startingGame}
                className="bg-bingo-green hover:bg-bingo-green/90 text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-bingo-green/25 h-12 sm:h-14 px-8 sm:px-12 text-base sm:text-lg gap-2"
              >
                {startingGame ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Zap className="size-5" />
                    INICIAR JOGO
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Waiting message for non-creator */}
          {gameStatus === 'aguardando' && !isCreator && (
            <div className="flex justify-center pb-2">
              <div className="glass-card rounded-xl px-6 py-3 text-center">
                <p className="text-muted-foreground text-sm">
                  Aguardando o criador da sala iniciar o jogo...
                </p>
                <Loader2 className="size-4 animate-spin text-bingo-green mx-auto mt-2" />
              </div>
            </div>
          )}

          {/* Cards grid */}
          {cartelaData.length > 0 ? (
            <div className={`grid gap-3 sm:gap-4 ${
              cartelaData.length === 1 ? 'grid-cols-1 max-w-[240px] sm:max-w-[280px] mx-auto'
                : cartelaData.length === 2 ? 'grid-cols-2 max-w-[480px] sm:max-w-[560px] mx-auto'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {cartelaData.map((card, idx) => {
                const markedSet = markedNumbers.get(idx) || new Set<number>()
                return (
                  <BingoCard
                    key={card.id}
                    cardIndex={idx}
                    card={card.numeros}
                    cardId={card.id}
                    drawnNumbers={drawnSet}
                    markedSet={markedSet}
                    onToggleMark={handleToggleMark}
                  />
                )
              })}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma cartela encontrada.</p>
            </div>
          )}

          {/* BINGO Button */}
          <div className="flex justify-center pt-2 pb-4">
            <Button
              onClick={() => {
                // Find the first card that has a valid bingo pattern
                // Try all cards and find one that's valid
                if (cartelaData.length === 0) return

                // If only one card, claim directly
                if (cartelaData.length === 1) {
                  handleClaimBingo(cartelaData[0].id)
                  return
                }

                // Multiple cards - try to find one with a valid bingo
                // For simplicity, we'll check each card and claim the first valid one
                const checkCardBingo = (card: number[][], marks: Set<number>): boolean => {
                  const isMarked = (num: number): boolean => num === 0 || marks.has(num)
                  // Check rows
                  for (let row = 0; row < 5; row++) {
                    if (card[row].every(isMarked)) return true
                  }
                  // Check columns
                  for (let col = 0; col < 5; col++) {
                    let complete = true
                    for (let row = 0; row < 5; row++) {
                      if (!isMarked(card[row][col])) { complete = false; break }
                    }
                    if (complete) return true
                  }
                  // Check diagonals
                  let mainDiag = true
                  for (let i = 0; i < 5; i++) {
                    if (!isMarked(card[i][i])) { mainDiag = false; break }
                  }
                  if (mainDiag) return true
                  let antiDiag = true
                  for (let i = 0; i < 5; i++) {
                    if (!isMarked(card[i][4 - i])) { antiDiag = false; break }
                  }
                  if (antiDiag) return true
                  return false
                }

                let foundValid = false
                for (let idx = 0; idx < cartelaData.length; idx++) {
                  const marks = markedNumbers.get(idx) || new Set<number>()
                  if (checkCardBingo(cartelaData[idx].numeros, marks)) {
                    handleClaimBingo(cartelaData[idx].id)
                    foundValid = true
                    break
                  }
                }

                if (!foundValid) {
                  toast.error('Nenhuma cartela com padrão de bingo completo. Continue marcando!')
                }
              }}
              disabled={gameStatus !== 'em_andamento' || claimingBingo}
              className={`
                font-extrabold rounded-2xl transition-all text-xl sm:text-2xl h-14 sm:h-16 px-10 sm:px-16 gap-2
                ${gameStatus === 'em_andamento'
                  ? 'bg-bingo-gold hover:bg-bingo-gold/90 text-black hover:shadow-lg hover:shadow-bingo-gold/25'
                  : 'bg-white/10 text-muted-foreground/40 cursor-not-allowed'
                }
              `}
            >
              {claimingBingo ? (
                <>
                  <Loader2 className="size-6 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Trophy className="size-6" />
                  BINGO!
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Sidebar - Drawn numbers */}
        <aside className="lg:w-[30%] lg:min-w-[260px] lg:max-w-[360px] border-t lg:border-t-0 lg:border-l border-white/5">
          <div className="glass-strong p-3 sm:p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground text-sm sm:text-base">
                Números Sorteados
              </h2>
              <Badge variant="secondary" className="text-xs">
                {drawnNumbers.length}/75
              </Badge>
            </div>

            {/* Mini ball grid at top */}
            {drawnNumbers.length > 0 && (
              <div className="mb-4 p-2 bg-white/5 rounded-lg">
                <div className="flex flex-wrap gap-1 justify-center">
                  {drawnNumbers.slice(-20).map((num) => (
                    <span
                      key={num}
                      className={`
                        inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-[10px] sm:text-xs font-bold
                        ${num === drawnNumbers[drawnNumbers.length - 1]
                          ? `${isSpecialBall(num) ? 'bingo-ball-gold' : 'bingo-ball-3d'} text-white pulse-glow`
                          : 'bg-white/10 text-muted-foreground'
                        }
                      `}
                    >
                      {num}
                    </span>
                  ))}
                  {drawnNumbers.length > 20 && (
                    <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-[10px] text-muted-foreground/50">
                      +{drawnNumbers.length - 20}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* B-I-N-G-O columns */}
            <ScrollArea className="flex-1 custom-scrollbar">
              {drawnNumbers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                  <Volume2 className="size-8 mb-2" />
                  <p className="text-xs text-center">Nenhum número sorteado ainda</p>
                </div>
              ) : (
                <DrawnNumbersGrid drawnNumbers={drawnNumbers} />
              )}
            </ScrollArea>

            {/* Prize display */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prêmio acumulado</span>
                <span className="text-bingo-gold font-bold text-lg">
                  R$ {prize.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                {sala.jogadores_count} jogador(es) × R$ 0,50
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Game finalized overlay (not a win by self - just showing result) */}
      {gameStatus === 'finalizado' && !showWinDialog && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl p-6 sm:p-8 max-w-md w-full text-center celebrate">
            <Trophy className="size-16 text-bingo-gold mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extrabold gradient-text mb-2">
              Jogo Finalizado!
            </h2>
            <p className="text-muted-foreground mb-6">
              O jogo foi encerrado. {winner ? `Vencedor: ${winner}` : 'Alguém venceu esta rodada!'}
            </p>
            <Button
              onClick={handleLeaveRoom}
              className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-bingo-green/25 px-8"
            >
              <ArrowLeft className="size-4" />
              Voltar ao Lobby
            </Button>
          </div>
        </div>
      )}

      {/* Win celebration dialog */}
      {showWinDialog && winData && (
        <>
          <ConfettiOverlay />
          <Dialog open={showWinDialog} onOpenChange={() => {}}>
            <DialogContent className="glass-strong border-bingo-gold/30 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Trophy className="size-16 text-bingo-gold celebrate" />
                    <span className="text-3xl sm:text-4xl font-extrabold gradient-text">
                      BINGO!
                    </span>
                  </div>
                </DialogTitle>
                <DialogDescription className="text-center text-lg pt-2">
                  {winData.isSelf
                    ? 'Parabéns! Você venceu esta rodada!'
                    : `${winData.nome} venceu esta rodada!`
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 flex flex-col items-center gap-4">
                <div className="bg-bingo-gold/10 border border-bingo-gold/20 rounded-xl p-4 w-full text-center">
                  <p className="text-sm text-muted-foreground mb-1">Prêmio</p>
                  <p className="text-3xl font-extrabold text-bingo-gold">
                    R$ {winData.premio.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {drawnNumbers.length} números sorteados
                </p>
              </div>

              <DialogFooter className="sm:justify-center">
                <Button
                  onClick={handleLeaveRoom}
                  className="bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-bingo-green/25 px-8 w-full sm:w-auto"
                >
                  <ArrowLeft className="size-4" />
                  Voltar ao Lobby
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
