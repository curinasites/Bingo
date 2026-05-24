import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorização não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get the user
    const { data: userData, error: userError } = await supabase.auth.getUser(token)

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      )
    }

    const user = userData.user

    // Get user's wallet balance
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (carteiraError) {
      console.error('Error fetching carteira:', carteiraError)
    }

    // Check if user is admin
    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = !!adminData
    const adminRole = adminData?.role || null

    // Get user name from metadata
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'

    // Cache/update user profile in local database for admin panel lookups
    try {
      await db.userProfile.upsert({
        where: { supabaseId: user.id },
        update: { email: user.email ?? '', name: userName, updatedAt: new Date() },
        create: { supabaseId: user.id, email: user.email ?? '', name: userName },
      })
    } catch (profileError) {
      console.error('Error caching user profile:', profileError)
      // Non-critical: continue anyway
    }

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
