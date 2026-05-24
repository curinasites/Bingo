import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wwmvbralxvubpmhljkwq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bXZicmFseHZ1YnBtaGxqa3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NTYyNDYsImV4cCI6MjA5NTEzMjI0Nn0.NhhvrK3IDkCaKowoYgU8kICqyq2kdfHCU50In00vLc8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Types
export interface Sala {
  id: number
  nome: string
  status: 'aguardando' | 'em_andamento' | 'finalizado'
  criador_id: string
  created_at: string
  criador_nome?: string
  jogadores_count?: number
}

export interface Sorteio {
  id: number
  sala_id: number
  numero: number
  ordem: number
}

export interface Cartela {
  id: number
  sala_id: number
  jogador_id: string
  numeros: number[][]
  created_at: string
}

export interface Carteira {
  id: number
  user_id: string
  saldo: number
  updated_at: string
}

export interface Admin {
  id: string
  role: string
}
