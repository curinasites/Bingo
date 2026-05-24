import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateBingoCard } from '@/lib/bingo-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/salas/[id]/join - Join a room
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Get the room
    const { data: sala, error: salaError } = await supabase
      .from('salas')
      .select('*')
      .eq('id', id)
      .single()

    if (salaError || !sala) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    // Room must be in 'aguardando' status to join
    if (sala.status !== 'aguardando') {
      return NextResponse.json({ error: 'Não é possível entrar em uma sala que já começou' }, { status: 400 })
    }

    // Check if player already has a cartela in this room
    const { data: existingCartela } = await supabase
      .from('cartelas')
      .select('id')
      .eq('sala_id', id)
      .eq('jogador_id', user.id)
      .limit(1)

    if (existingCartela && existingCartela.length > 0) {
      return NextResponse.json({ error: 'Você já está nesta sala' }, { status: 400 })
    }

    // Check player's wallet balance
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .select('saldo')
      .eq('user_id', user.id)
      .single()

    if (carteiraError || !carteira) {
      return NextResponse.json({ error: 'Carteira não encontrada' }, { status: 404 })
    }

    const JOIN_COST = 1.0
    if (carteira.saldo < JOIN_COST) {
      return NextResponse.json({ error: 'Saldo insuficiente para entrar na sala (R$1,00)' }, { status: 400 })
    }

    // Deduct R$1.00 from player's wallet
    const newBalance = Math.round((carteira.saldo - JOIN_COST) * 100) / 100
    const { error: updateError } = await supabase
      .from('carteiras')
      .update({ saldo: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao debitar da carteira' }, { status: 500 })
    }

    // Create a free cartela for the player
    const cartelaNumeros = generateBingoCard()
    const { data: cartela, error: cartelaError } = await supabase
      .from('cartelas')
      .insert({
        sala_id: parseInt(id),
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
      message: 'Você entrou na sala com sucesso',
      sala: {
        id: sala.id,
        nome: sala.nome,
        status: sala.status,
      },
      cartela,
      saldo_restante: newBalance,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
