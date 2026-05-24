import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Helper to verify admin access
async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { authorized: false, error: 'Não autorizado', status: 401 }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { authorized: false, error: 'Token inválido', status: 401 }

  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminError || !adminData) {
    return { authorized: false, error: 'Acesso negado. Apenas administradores', status: 403 }
  }

  return { authorized: true, user, adminData }
}

// GET /api/admin - List all users with their carteira balance
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request)
    if (!adminCheck.authorized) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    // Try the Supabase RPC function first
    const { data: usersWithCarteiras, error: rpcError } = await supabase
      .rpc('get_users_with_carteiras')

    if (!rpcError && usersWithCarteiras) {
      const enrichedUsers = (usersWithCarteiras ?? []).map((row: { user_id: string; email: string; nome: string; saldo: number; updated_at: string }) => ({
        carteira_id: 0,
        user_id: row.user_id,
        email: row.email,
        nome: row.nome,
        saldo: row.saldo,
        updated_at: row.updated_at,
      }))

      const { count: salasCount } = await supabase
        .from('salas')
        .select('*', { count: 'exact', head: true })

      const { count: activeSalasCount } = await supabase
        .from('salas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_andamento')

      return NextResponse.json({
        users: enrichedUsers,
        stats: {
          total_users: enrichedUsers.length,
          total_salas: salasCount ?? 0,
          active_salas: activeSalasCount ?? 0,
        },
      })
    }

    // Fallback: query carteiras directly
    const { data: carteiras, error: carteirasError } = await supabase
      .from('carteiras')
      .select('id, user_id, saldo, updated_at')

    if (carteirasError) {
      return NextResponse.json({ error: carteirasError.message }, { status: 500 })
    }

    const enrichedUsers = (carteiras ?? []).map((carteira) => ({
      carteira_id: carteira.id,
      user_id: carteira.user_id,
      email: `user-${carteira.user_id.slice(0, 8)}...`,
      nome: `Usuário ${carteira.user_id.slice(0, 6)}`,
      saldo: carteira.saldo,
      updated_at: carteira.updated_at,
    }))

    const { count: salasCount } = await supabase
      .from('salas')
      .select('*', { count: 'exact', head: true })

    const { count: activeSalasCount } = await supabase
      .from('salas')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'em_andamento')

    return NextResponse.json({
      users: enrichedUsers,
      stats: {
        total_users: enrichedUsers.length,
        total_salas: salasCount ?? 0,
        active_salas: activeSalasCount ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH /api/admin - Update user's carteira balance
export async function PATCH(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request)
    if (!adminCheck.authorized) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const body = await request.json()
    const { user_id, saldo } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 })
    }

    if (typeof saldo !== 'number' || saldo < 0) {
      return NextResponse.json({ error: 'saldo deve ser um número não negativo' }, { status: 400 })
    }

    const { data: carteira, error: updateError } = await supabase
      .from('carteiras')
      .update({ saldo: Math.round(saldo * 100) / 100, updated_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .select()
      .single()

    if (updateError || !carteira) {
      return NextResponse.json({ error: 'Erro ao atualizar saldo' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Saldo atualizado com sucesso',
      carteira,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/admin - Delete a room (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request)
    if (!adminCheck.authorized) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
    }

    const body = await request.json()
    const { sala_id } = body

    if (!sala_id) {
      return NextResponse.json({ error: 'sala_id é obrigatório' }, { status: 400 })
    }

    const { data: sala, error: salaError } = await supabase
      .from('salas')
      .select('id, nome')
      .eq('id', sala_id)
      .single()

    if (salaError || !sala) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    await supabase.from('sorteios').delete().eq('sala_id', sala_id)
    await supabase.from('cartelas').delete().eq('sala_id', sala_id)

    const { error: deleteError } = await supabase
      .from('salas')
      .delete()
      .eq('id', sala_id)

    if (deleteError) {
      return NextResponse.json({ error: 'Erro ao excluir sala' }, { status: 500 })
    }

    return NextResponse.json({
      message: `Sala "${sala.nome}" excluída com sucesso`,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
  }
