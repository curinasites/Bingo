import { create } from 'zustand'

export type View = 'login' | 'lobby' | 'game' | 'admin'

interface UserProfile {
  id: string
  email: string
  nome: string
  saldo: number
  isAdmin: boolean
}

interface BingoStore {
  // Navigation
  view: View
  setView: (view: View) => void

  // User
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void

  // Game
  currentSalaId: number | null
  setCurrentSalaId: (id: number | null) => void

  // Drawn numbers for current game
  drawnNumbers: number[]
  setDrawnNumbers: (numbers: number[]) => void
  addDrawnNumber: (number: number) => void

  // Game status
  gameStatus: 'aguardando' | 'em_andamento' | 'finalizado'
  setGameStatus: (status: 'aguardando' | 'em_andamento' | 'finalizado') => void

  // Winner
  winner: string | null
  setWinner: (winner: string | null) => void

  // Current drawn ball (for animation)
  currentBall: number | null
  setCurrentBall: (ball: number | null) => void

  // Cartelas
  cartelas: number[][][]
  setCartelas: (cartelas: number[][][]) => void

  // Marked numbers per cartela
  markedNumbers: Map<number, Set<number>>
  toggleMark: (cartelaIndex: number, number: number) => void
  clearMarks: () => void

  // Reset game state
  resetGame: () => void
}

export const useBingoStore = create<BingoStore>((set) => ({
  view: 'login',
  setView: (view) => set({ view }),

  user: null,
  setUser: (user) => set({ user }),

  currentSalaId: null,
  setCurrentSalaId: (id) => set({ currentSalaId: id }),

  drawnNumbers: [],
  setDrawnNumbers: (numbers) => set({ drawnNumbers: numbers }),
  addDrawnNumber: (number) => set((state) => ({
    drawnNumbers: [...state.drawnNumbers, number]
  })),

  gameStatus: 'aguardando',
  setGameStatus: (status) => set({ gameStatus: status }),

  winner: null,
  setWinner: (winner) => set({ winner }),

  currentBall: null,
  setCurrentBall: (ball) => set({ currentBall: ball }),

  cartelas: [],
  setCartelas: (cartelas) => set({ cartelas }),

  markedNumbers: new Map(),
  toggleMark: (cartelaIndex, number) => set((state) => {
    const newMap = new Map(state.markedNumbers)
    const currentSet = new Set(newMap.get(cartelaIndex) || [])
    if (currentSet.has(number)) {
      currentSet.delete(number)
    } else {
      currentSet.add(number)
    }
    newMap.set(cartelaIndex, currentSet)
    return { markedNumbers: new Map() }
  }),
  clearMarks: () => set({ markedNumbers: new Map() }),

  resetGame: () => set({
    currentSalaId: null,
    drawnNumbers: [],
    gameStatus: 'aguardando',
    winner: null,
    currentBall: null,
    cartelas: [],
    markedNumbers: new Map()
  })
}))
