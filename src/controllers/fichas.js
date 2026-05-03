-- =============================================
-- FICHA TÉCNICA
-- Relaciona produto de venda com seus insumos
-- =============================================

CREATE TABLE IF NOT EXISTS fichas_tecnicas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id    uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  insumo_id     uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade    numeric(12,4) NOT NULL CHECK (quantidade > 0),
  unidade       text NOT NULL DEFAULT 'un',
  observacao    text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, insumo_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fichas_produto ON fichas_tecnicas(produto_id);
CREATE INDEX IF NOT EXISTS idx_fichas_insumo  ON fichas_tecnicas(insumo_id);

-- Atualiza automaticamente o campo atualizado_em
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fichas_tecnicas_ts ON fichas_tecnicas;
CREATE TRIGGER trg_fichas_tecnicas_ts
  BEFORE UPDATE ON fichas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- RLS: desabilita (a API usa service role key)
ALTER TABLE fichas_tecnicas DISABLE ROW LEVEL SECURITY;-- =============================================
-- FICHA TÉCNICA
-- Relaciona produto de venda com seus insumos
-- =============================================

CREATE TABLE IF NOT EXISTS fichas_tecnicas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id    uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  insumo_id     uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade    numeric(12,4) NOT NULL CHECK (quantidade > 0),
  unidade       text NOT NULL DEFAULT 'un',
  observacao    text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, insumo_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fichas_produto ON fichas_tecnicas(produto_id);
CREATE INDEX IF NOT EXISTS idx_fichas_insumo  ON fichas_tecnicas(insumo_id);

-- Atualiza automaticamente o campo atualizado_em
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fichas_tecnicas_ts ON fichas_tecnicas;
CREATE TRIGGER trg_fichas_tecnicas_ts
  BEFORE UPDATE ON fichas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- RLS: desabilita (a API usa service role key)
ALTER TABLE fichas_tecnicas DISABLE ROW LEVEL SECURITY;
