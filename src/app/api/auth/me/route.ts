import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorização não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const { data: userData, error: userError } = await supabase.auth.getUser(token)

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    const user = userData.user

    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (carteiraError) {
      console.error('Error fetching carteira:', carteiraError)
    }

    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = !!adminData
    const adminRole = adminData?.role || null

    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: userName,
        created_at: user.created_at,
        avatar_url: user.user_metadata?.avatar_url || null,
      },
      saldo: carteira?.saldo ?? 0,
      isAdmin,
      adminRole,
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
