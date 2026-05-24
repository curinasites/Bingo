import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/salas/[id] - Get room details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const { data: sala, error } = await supabase
      .from('salas')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !sala) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    // Get player count
    const { data: cartelas } = await supabase
      .from('cartelas')
      .select('jogador_id')
      .eq('sala_id', id)

    const uniquePlayers = new Set(cartelas?.map((c) => c.jogador_id) ?? [])

    // Get drawn numbers count
    const { count: sorteiosCount } = await supabase
      .from('sorteios')
      .select('*', { count: 'exact', head: true })
      .eq('sala_id', id)

    // Get creator name from the sala record (stored on creation)
    const criadorNome = (sala as Record<string, unknown>).criador_nome as string || 'Desconhecido'

    return NextResponse.json({
      sala: {
        ...sala,
        criador_nome: criadorNome,
        jogadores_count: uniquePlayers.size,
        sorteios_count: sorteiosCount ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH /api/salas/[id] - Update room status (start game)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Only creator can start the game
    if (sala.criador_id !== user.id) {
      return NextResponse.json({ error: 'Apenas o criador da sala pode iniciar o jogo' }, { status: 403 })
    }

    // Room must be in 'aguardando' status to start
    if (sala.status !== 'aguardando') {
      return NextResponse.json({ error: 'A sala não está aguardando para iniciar' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    if (status !== 'em_andamento') {
      return NextResponse.json({ error: 'Status inválido. Use "em_andamento" para iniciar' }, { status: 400 })
    }

    // Update room status
    const { data: updatedSala, error: updateError } = await supabase
      .from('salas')
      .update({ status: 'em_andamento' })
      .eq('id', id)
      .select()
      .single()

    if (updateError || !updatedSala) {
      return NextResponse.json({ error: 'Erro ao atualizar status da sala' }, { status: 500 })
    }

    return NextResponse.json({ sala: updatedSala })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/salas/[id] - Delete room (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem excluir salas' }, { status: 403 })
    }

    // Delete related records first
    await supabase.from('sorteios').delete().eq('sala_id', id)
    await supabase.from('cartelas').delete().eq('sala_id', id)

    // Delete the room
    const { error: deleteError } = await supabase
      .from('salas')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: 'Erro ao excluir sala' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Sala excluída com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
