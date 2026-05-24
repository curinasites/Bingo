import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sorteios - List drawn numbers for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const salaId = searchParams.get('sala_id')

    if (!salaId) {
      return NextResponse.json({ error: 'Parâmetro sala_id é obrigatório' }, { status: 400 })
    }

    const { data: sorteios, error } = await supabase
      .from('sorteios')
      .select('*')
      .eq('sala_id', salaId)
      .order('ordem', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sorteios })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/sorteios - Draw a number
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

    // Only the creator can draw numbers
    if (sala.criador_id !== user.id) {
      return NextResponse.json({ error: 'Apenas o criador da sala pode sortear números' }, { status: 403 })
    }

    // Game must be in progress
    if (sala.status !== 'em_andamento') {
      return NextResponse.json({ error: 'O jogo não está em andamento' }, { status: 400 })
    }

    // Get already drawn numbers for this room
    const { data: existingSorteios, error: sorteiosError } = await supabase
      .from('sorteios')
      .select('numero, ordem')
      .eq('sala_id', sala_id)

    if (sorteiosError) {
      return NextResponse.json({ error: 'Erro ao buscar sorteios existentes' }, { status: 500 })
    }

    const drawnNumbers = new Set((existingSorteios ?? []).map((s) => s.numero))

    // Check if all 75 numbers have been drawn
    if (drawnNumbers.size >= 75) {
      return NextResponse.json({ error: 'Todos os números já foram sorteados' }, { status: 400 })
    }

    // Generate a random number that hasn't been drawn yet
    const availableNumbers: number[] = []
    for (let i = 1; i <= 75; i++) {
      if (!drawnNumbers.has(i)) {
        availableNumbers.push(i)
      }
    }

    const randomIndex = Math.floor(Math.random() * availableNumbers.length)
    const drawnNumber = availableNumbers[randomIndex]
    const nextOrdem = (existingSorteios ?? []).length + 1

    // Insert the drawn number
    const { data: sorteio, error: insertError } = await supabase
      .from('sorteios')
      .insert({
        sala_id,
        numero: drawnNumber,
        ordem: nextOrdem,
      })
      .select()
      .single()

    if (insertError || !sorteio) {
      return NextResponse.json({ error: 'Erro ao registrar sorteio' }, { status: 500 })
    }

    return NextResponse.json({ sorteio }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
