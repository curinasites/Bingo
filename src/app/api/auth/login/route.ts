import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      )
    }

    const user = authData.user
    const session = authData.session

    // Check if user has a carteiras entry, create one if not
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .select('*')
      .eq('user_id', user.id)
      .single()

    let userCarteira = carteira

    if (carteiraError || !carteira) {
      // Create carteiras entry with R$10.00 initial balance
      const { data: newCarteira, error: createError } = await supabase
        .from('carteiras')
        .insert({
          user_id: user.id,
          saldo: 10.0,
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating carteira:', createError)
        // Don't fail login, just log the error
      } else {
        userCarteira = newCarteira
      }
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
    const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário'

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: userName,
        created_at: user.created_at,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
      saldo: userCarteira?.saldo ?? 10.0,
      isAdmin,
      adminRole,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
