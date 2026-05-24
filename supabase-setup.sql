-- ============================================
-- Bingo Auto - Script de Setup do Supabase
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- 1. Criar tabela de salas
CREATE TABLE IF NOT EXISTS salas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'aguardando',
  criador_id UUID REFERENCES auth.users(id),
  criador_nome TEXT DEFAULT 'Desconhecido',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de sorteios
CREATE TABLE IF NOT EXISTS sorteios (
  id SERIAL PRIMARY KEY,
  sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  ordem INTEGER NOT NULL
);

-- 3. Criar tabela de cartelas
CREATE TABLE IF NOT EXISTS cartelas (
  id SERIAL PRIMARY KEY,
  sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES auth.users(id),
  numeros JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Criar tabela de carteiras (saldo dos usuários)
CREATE TABLE IF NOT EXISTS carteiras (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  saldo DECIMAL(10,2) DEFAULT 10.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Criar tabela de admins
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT DEFAULT 'super_admin'
);

-- ============================================
-- RLS (Row Level Security) - Políticas
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorteios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE carteiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Políticas para salas (leitura pública, escrita autenticada)
CREATE POLICY "Salas são visíveis para todos" ON salas
  FOR SELECT USING (true);

CREATE POLICY "Usuários autenticados podem criar salas" ON salas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Criador pode atualizar sua sala" ON salas
  FOR UPDATE USING (auth.uid() = criador_id OR EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  ));

-- Políticas para sorteios (leitura pública, escrita autenticada)
CREATE POLICY "Sorteios são visíveis para todos" ON sorteios
  FOR SELECT USING (true);

CREATE POLICY "Criador da sala pode criar sorteios" ON sorteios
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM salas WHERE salas.id = sorteios.sala_id AND salas.criador_id = auth.uid()
    )
  );

-- Políticas para cartelas (leitura própria, escrita autenticada)
CREATE POLICY "Usuários podem ver suas próprias cartelas" ON cartelas
  FOR SELECT USING (
    jogador_id = auth.uid() OR EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários autenticados podem criar cartelas" ON cartelas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para carteiras (leitura e atualização própria)
CREATE POLICY "Usuários podem ver sua própria carteira" ON carteiras
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar sua própria carteira" ON carteiras
  FOR UPDATE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários autenticados podem criar carteiras" ON carteiras
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para admins (leitura para admins)
CREATE POLICY "Admins podem ver a tabela de admins" ON admins
  FOR SELECT USING (true);

-- ============================================
-- Função para adicionar o admin automaticamente
-- Execute APÓS criar a conta admin@admin.com
-- ============================================

-- Primeiro crie a conta admin@admin.com pelo site, depois execute:
-- INSERT INTO admins (id, role) VALUES ('UUID_DO_ADMIN_AQUI', 'super_admin');

-- Para encontrar o UUID do admin:
-- SELECT id, email FROM auth.users WHERE email = 'admin@admin.com';

-- ============================================
-- RPC Function: get_users_with_carteiras
-- Retorna dados de usuários com suas carteiras
-- Usa SECURITY DEFINER para acessar auth.users
-- ============================================

CREATE OR REPLACE FUNCTION get_users_with_carteiras()
RETURNS TABLE(user_id UUID, email TEXT, nome TEXT, saldo NUMERIC, updated_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    c.user_id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as nome,
    c.saldo,
    c.updated_at
  FROM carteiras c
  JOIN auth.users u ON u.id = c.user_id
  ORDER BY c.updated_at DESC;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_users_with_carteiras() TO anon;
GRANT EXECUTE ON FUNCTION get_users_with_carteiras() TO authenticated;

-- ============================================
-- DESATIVAR CONFIRMAÇÃO DE EMAIL
-- ============================================
-- Vá em: Authentication > Providers > Email
-- Desative "Confirm email" e salve
