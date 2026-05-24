'use client'

import { useState, useMemo, useCallback } from 'react'
import { useBingoStore } from '@/store/bingo-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

// Particle component for floating bingo numbers
function ParticleBackground() {
  const particles = useMemo(() => {
    const items = []
    for (let i = 0; i < 35; i++) {
      const num = Math.floor(Math.random() * 75) + 1
      items.push({
        id: i,
        number: num,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 16 + 12,
        duration: Math.random() * 12 + 10,
        delay: Math.random() * -20,
        opacity: Math.random() * 0.25 + 0.05,
      })
    }
    return items
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-bingo-green font-mono font-bold select-none"
          style={{
            left: p.left,
            top: p.top,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        >
          {p.number}
        </span>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { setUser, setView } = useBingoStore()

  // Tab state
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Preencha todos os campos.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login.')
        toast.error(data.error || 'Credenciais inv\u00e1lidas.')
        return
      }

      // Store token in localStorage
      if (data.session?.access_token) {
        localStorage.setItem('bingo_token', data.session.access_token)
      }

      // Update Zustand store
      setUser({
        id: data.user.id,
        email: data.user.email,
        nome: data.user.name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Jogador',
        saldo: data.saldo ?? 0,
        isAdmin: data.isAdmin ?? false,
      })

      toast.success('Bem-vindo! Login realizado com sucesso.')

      // Navigate to admin or lobby
      setView(data.isAdmin ? 'admin' : 'lobby')
    } catch {
      setError('Erro de conex\u00e3o. Tente novamente.')
      toast.error('N\u00e3o foi poss\u00edvel conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }, [loginEmail, loginPassword, setUser, setView])

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim() || !registerConfirmPassword.trim()) {
      setError('Preencha todos os campos.')
      return
    }

    if (registerPassword.length < 6) {
      setError('A senha deve ter no m\u00ednimo 6 caracteres.')
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      setError('As senhas n\u00e3o coincidem.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail.trim(),
          password: registerPassword,
          name: registerName.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta.')
        toast.error(data.error || 'N\u00e3o foi poss\u00edvel criar a conta.')
        return
      }

      // Auto-login after registration
      if (data.session?.access_token) {
        localStorage.setItem('bingo_token', data.session.access_token)
      }

      setUser({
        id: data.user.id,
        email: data.user.email,
        nome: registerName.trim(),
        saldo: data.saldo ?? 10,
        isAdmin: false,
      })

      toast.success('Conta criada! Bem-vindo ao Bingo Auto!')

      setView('lobby')
    } catch {
      setError('Erro de conex\u00e3o. Tente novamente.')
      toast.error('N\u00e3o foi poss\u00edvel conectar ao servidor.')
    } finally {
      setLoading(false)
    }
  }, [registerName, registerEmail, registerPassword, registerConfirmPassword, setUser, setView])

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#0a0a1a' }}>
      {/* Particle background */}
      <ParticleBackground />

      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-bingo-green/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-bingo-gold/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

      {/* Main card */}
      <Card className="glass-strong relative z-10 w-full max-w-md mx-4 sm:mx-0 rounded-2xl shadow-2xl shadow-black/30">
        <CardContent className="p-6 sm:p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold gradient-text tracking-wider mb-2">
              BINGO AUTO
            </h1>
            <p className="text-muted-foreground text-sm">
              Jogue e ganhe em tempo real
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'register'); setError('') }} className="w-full">
            <TabsList className="w-full mb-6 bg-muted/50 rounded-lg">
              <TabsTrigger value="login" className="flex-1 gap-1.5 data-[state=active]:bg-bingo-green/20 data-[state=active]:text-bingo-green rounded-md">
                <LogIn className="size-4" />
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 gap-1.5 data-[state=active]:bg-bingo-green/20 data-[state=active]:text-bingo-green rounded-md">
                <UserPlus className="size-4" />
                Cadastrar
              </TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11 pr-10"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && activeTab === 'login' && (
                  <p className="text-destructive text-sm text-center animate-in fade-in slide-in-from-top-1">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Entrar
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  N\u00e3o tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => { setActiveTab('register'); setError('') }}
                    className="text-bingo-green hover:underline font-medium"
                  >
                    Cadastre-se
                  </button>
                </p>
              </form>
            </TabsContent>

            {/* Register Form */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nome</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Seu nome"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">E-mail</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="M\u00ednimo 6 caracteres"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11 pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="register-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      className="bg-white/5 border-white/10 focus:border-bingo-green/50 focus:ring-bingo-green/30 placeholder:text-muted-foreground/50 h-11 pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && activeTab === 'register' && (
                  <p className="text-destructive text-sm text-center animate-in fade-in slide-in-from-top-1">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-bingo-green hover:bg-bingo-green/90 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-bingo-green/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Cadastrar
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  J\u00e1 tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => { setActiveTab('login'); setError('') }}
                    className="text-bingo-green hover:underline font-medium"
                  >
                    Fa\u00e7a login
                  </button>
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
