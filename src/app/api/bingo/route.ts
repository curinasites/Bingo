import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkBingo } from '@/lib/bingo-utils'

// POST /api/bingo - Claim bingo
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
    const { sala_id, cartela_id } = body

    if (!sala_id) {
      return NextResponse.json({ error: 'sala_id é obrigatório' }, { status: 400 })
    }

    if (!cartela_id) {
      return NextResponse.json({ error: 'cartela_id é obrigatório' }, { status: 400 })
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

    // Room must be in progress
    if (sala.status !== 'em_andamento') {
      return NextResponse.json({ error: 'O jogo não está em andamento' }, { status: 400 })
    }

    // Get the player's cartela
    const { data: cartela, error: cartelaError } = await supabase
      .from('cartelas')
      .select('*')
      .eq('id', cartela_id)
      .eq('jogador_id', user.id)
      .eq('sala_id', sala_id)
      .single()

    if (cartelaError || !cartela) {
      return NextResponse.json({ error: 'Cartela não encontrada ou não pertence a você' }, { status: 404 })
    }

    // Get all drawn numbers for this room
    const { data: sorteios, error: sorteiosError } = await supabase
      .from('sorteios')
      .select('numero')
      .eq('sala_id', sala_id)

    if (sorteiosError) {
      return NextResponse.json({ error: 'Erro ao buscar números sorteados' }, { status: 500 })
    }

    const drawnNumbers = (sorteios ?? []).map((s) => s.numero)

    // Check if the card has a valid bingo
    const hasBingo = checkBingo(cartela.numeros as number[][], drawnNumbers)

    if (!hasBingo) {
      return NextResponse.json({ error: 'Bingo inválido! Nenhum padrão completo encontrado na sua cartela' }, { status: 400 })
    }

    // Bingo is valid! End the game
    // Calculate prize: count total players (unique jogador_ids) * R$1.00 entry + extra card revenue
    const { data: allCartelas } = await supabase
      .from('cartelas')
      .select('jogador_id')
      .eq('sala_id', sala_id)

    const uniquePlayers = new Set(allCartelas?.map((c) => c.jogador_id) ?? [])
    const totalCards = allCartelas?.length ?? 0
    const freeCards = uniquePlayers.size // First card per player is free
    const extraCards = totalCards - freeCards
    const prize = Math.round((uniquePlayers.size * 1.0 + extraCards * 2.0) * 100) / 100

    // Update room status to 'finalizado'
    const { data: updatedSala, error: updateError } = await supabase
      .from('salas')
      .update({ status: 'finalizado' })
      .eq('id', sala_id)
      .select()
      .single()

    if (updateError || !updatedSala) {
      return NextResponse.json({ error: 'Erro ao finalizar o jogo' }, { status: 500 })
    }

    // Add prize to winner's wallet
    const { data: winnerCarteira } = await supabase
      .from('carteiras')
      .select('saldo')
      .eq('user_id', user.id)
      .single()

    let newBalance = 0
    if (winnerCarteira) {
      newBalance = Math.round((winnerCarteira.saldo + prize) * 100) / 100
      await supabase
        .from('carteiras')
        .update({ saldo: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }

    // Get winner's name from metadata (use user name from request context)
    const winnerName = user.user_metadata?.name || user.email?.split('@')[0] || 'Desconhecido'

    return NextResponse.json({
      message: 'BINGO! Parabéns, você venceu!',
      vencedor: {
        id: user.id,
        nome: winnerName,
        email: user.email,
      },
      cartela_id: cartela.id,
      sala: updatedSala,
      premio: prize,
      novo_saldo: newBalance,
      numeros_sorteados: drawnNumbers.length,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
