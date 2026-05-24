import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateBingoCard } from '@/lib/bingo-utils'

// GET /api/salas - List all rooms
export async function GET() {
  try {
    const { data: salas, error } = await supabase
      .from('salas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get player counts for each room
    const { data: cartelaCounts } = await supabase
      .from('cartelas')
      .select('sala_id, jogador_id')

    const playerCountMap = new Map<number, Set<string>>()
    if (cartelaCounts) {
      for (const c of cartelaCounts) {
        if (!playerCountMap.has(c.sala_id)) {
          playerCountMap.set(c.sala_id, new Set())
        }
        playerCountMap.get(c.sala_id)!.add(c.jogador_id)
      }
    }

    const enrichedSalas = (salas ?? []).map((sala: Record<string, unknown>) => {
      const jogadores_count = playerCountMap.get(sala.id as number)?.size ?? 0
      return {
        ...sala,
        jogadores_count,
      }
    })

    return NextResponse.json(enrichedSalas)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/salas - Create a new room
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const { nome } = body

    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      return NextResponse.json({ error: 'Nome da sala é obrigatório' }, { status: 400 })
    }

    // Check creator's wallet balance
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .select('saldo')
      .eq('user_id', user.id)
      .single()

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: 'Carteira não encontrada' }, { status: 404 })
    }

    const ROOM_COST = 1.0
    if (carteira.saldo < ROOM_COST) {
      return NextResponse.json({ error: 'Saldo insuficiente para criar uma sala (R$1,00)' }, { status: 400 })
    }

    // Deduct R$1.00 from creator's wallet
    const newBalance = Math.round((carteira.saldo - ROOM_COST) * 100) / 100
    const { error: updateError } = await supabase
      .from('carteiras')
      .update({ saldo: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao debitar da carteira' }, { status: 500 })
    }

    // Create the room with creator name
    const creatorName = user.user_metadata?.name || user.email?.split('@')[0] || 'Desconhecido'
    const { data: sala, error: salaError } = await supabase
      .from('salas')
      .insert({
        nome: nome.trim(),
        status: 'aguardando',
        criador_id: user.id,
        criador_nome: creatorName,
      })
      .select()
      .single()

    if (salaError || !sala) {
      // Refund the creator
      await supabase
        .from('carteiras')
        .update({ saldo: carteira.saldo, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      return NextResponse.json({ error: 'Erro ao criar sala' }, { status: 500 })
    }

    // Auto-join creator to room with a free cartela
    const cartelaNumeros = generateBingoCard()

    const { error: cartelaError } = await supabase
      .from('cartelas')
      .insert({
        sala_id: sala.id,
        jogador_id: user.id,
        numeros: cartelaNumeros,
      })

    if (cartelaError) {
      // Room created but auto-join failed - still return the room
      console.error('Erro ao criar cartela automática:', cartelaError)
    }

    return NextResponse.json({
      sala: {
        ...sala,
        criador_nome: user.user_metadata?.name || 'Desconhecido',
        jogadores_count: 1,
      },
      saldo_restante: newBalance,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
