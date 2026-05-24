import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, senha e nome são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          full_name: name,
        },
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    const user = authData.user
    const session = authData.session

    const { data: carteira, error: carteiraError } = await supabase
      .from('carteiras')
      .insert({
        user_id: user.id,
        saldo: 10.0,
      })
      .select()
      .single()

    if (carteiraError) {
      console.error('Error creating carteira:', carteiraError)
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name,
        created_at: user.created_at,
      },
      session: session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
          }
        : null,
      saldo: carteira?.saldo ?? 10.0,
      isAdmin: false,
      message: 'Usuário registrado com sucesso',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
