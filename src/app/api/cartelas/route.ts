import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateBingoCard } from '@/lib/bingo-utils'

// GET /api/cartelas - List player's cards for a room
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const salaId = searchParams.get('sala_id')

    if (!salaId) {
      return NextResponse.json({ error: 'Parâmetro sala_id é obrigatório' }, { status: 400 })
    }

    const { data: cartelas, error } = await supabase
      .from('cartelas')
      .select('*')
      .eq('jogador_id', user.id)
      .eq('sala_id', salaId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ cartelas })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/cartelas - Buy an extra card
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
    const { sala_id } = body

    if (!sala_id) {
      return NextResponse.json({ error: 'sala_id é obrigatório' }, { status: 400 })
    }

    // Get the room
    const { data: sala, error: salaError } = await supabase
      .from('salas')
      .select('*')
      .eq('id', sala_id)
      .single()

    if (salaError || !sala) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    // Check if the player has at least one cartela (meaning they've joined)
    const { data: existingCartelas, error: checkError } = await supabase
      .from('cartelas')
      .select('id')
      .eq('sala_id', sala_id)
      .eq('jogador_id', user.id)

    if (checkError) {
      return NextResponse.json({ error: 'Erro ao verificar cartelas' }, { status: 500 })
    }

    if (!existingCartelas || existingCartelas.length === 0) {
      return NextResponse.json({ error: 'Você precisa entrar na sala primeiro' }, { status: 400 })
    }

    // Extra cards cost R$2.00 each
    const EXTRA_CARD_COST = 2.0

    // Check player's wallet balance
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .select('saldo')
      .eq('user_id', user.id)
      .single()

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: 'Carteira não encontrada' }, { status: 404 })
    }

    if (carteira.saldo < EXTRA_CARD_COST) {
      return NextResponse.json({ error: 'Saldo insuficiente para comprar cartela extra (R$2,00)' }, { status: 400 })
    }

    // Deduct R$2.00 from player's wallet
    const newBalance = Math.round((carteira.saldo - EXTRA_CARD_COST) * 100) / 100
    const { error: updateError } = await supabase
      .from('carteiras')
      .update({ saldo: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao debitar da carteira' }, { status: 500 })
    }

    // Generate and create the new cartela
    const cartelaNumeros = generateBingoCard()
    const { data: cartela, error: cartelaError } = await supabase
      .from('cartelas')
      .insert({
        sala_id,
        jogador_id: user.id,
        numeros: cartelaNumeros,
      })
      .select()
      .single()

    if (cartelaError || !cartela) {
      // Refund the player
      await supabase
        .from('carteiras')
        .update({ saldo: carteira.saldo, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      return NextResponse.json({ error: 'Erro ao criar cartela' }, { status: 500 })
    }

    return NextResponse.json({
      cartela,
      saldo_restante: newBalance,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
