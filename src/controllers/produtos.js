const supabase = require('../lib/supabase')

async function listarCategorias(req, res) {
  const { data, error } = await supabase
    .from('categorias').select('*').eq('ativo', true).order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar categorias' })
  return res.json(data)
}

async function criarCategoria(req, res) {
  const { nome, descricao } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' })
  const { data, error } = await supabase
    .from('categorias').insert({ nome, descricao }).select().single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Categoria ja existe' })
    return res.status(500).json({ erro: 'Erro ao criar categoria' })
  }
  return res.status(201).json(data)
}

async function atualizarCategoria(req, res) {
  const { id } = req.params
  const { nome, descricao, ativo } = req.body
  const { error } = await supabase
    .from('categorias').update({ nome, descricao, ativo }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar categoria' })
  return res.json({ mensagem: 'Categoria atualizada' })
}

async function listar(req, res) {
  const { categoria_id, tipo, ativo = 'true', busca } = req.query
  let query = supabase.from('produtos').select('*, categorias(id, nome)').order('nome')
  if (ativo !== 'todos') query = query.eq('ativo', ativo === 'true')
  if (categoria_id) query = query.eq('categoria_id', categoria_id)
  if (tipo) query = query.eq('tipo', tipo)
  if (busca) query = query.or(`nome.ilike.%${busca}%,sku.ilike.%${busca}%`)
  const { data, error } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar produtos' })
  return res.json(data)
}

async function buscarPorId(req, res) {
  const { id } = req.params
  const { data: produto, error } = await supabase
    .from('produtos').select('*, categorias(id, nome)').eq('id', id).single()
  if (error || !produto) return res.status(404).json({ erro: 'Produto nao encontrado' })
  const { data: posicoes } = await supabase
    .from('vw_posicao_estoque').select('*').eq('produto_id', id)
  return res.json({ ...produto, posicoes: posicoes || [] })
}

async function criar(req, res) {
  const { sku, nome, descricao, categoria_id, tipo, unidade, estoque_minimo, valor_venda } = req.body
  if (!sku || !nome || !categoria_id || !tipo) {
    return res.status(400).json({ erro: 'sku, nome, categoria_id e tipo sao obrigatorios' })
  }
  if (!['materia_prima', 'revenda', 'ambos'].includes(tipo)) {
    return res.status(400).json({ erro: 'tipo deve ser materia_prima, revenda ou ambos' })
  }
  const { data, error } = await supabase
    .from('produtos')
    .insert({
      sku,
      nome,
      descricao,
      categoria_id,
      tipo,
      unidade: unidade || 'un',
      estoque_minimo: estoque_minimo || 0,
      valor_venda: valor_venda || 0
    })
    .select('*, categorias(id, nome)').single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'SKU ja cadastrado' })
    return res.status(500).json({ erro: 'Erro ao criar produto' })
  }
  return res.status(201).json(data)
}

async function atualizar(req, res) {
  const { id } = req.params
  const { sku, nome, descricao, categoria_id, tipo, unidade, estoque_minimo, ativo, valor_venda } = req.body
  const updates = {}
  if (sku !== undefined) updates.sku = sku
  if (nome !== undefined) updates.nome = nome
  if (descricao !== undefined) updates.descricao = descricao
  if (categoria_id !== undefined) updates.categoria_id = categoria_id
  if (tipo !== undefined) updates.tipo = tipo
  if (unidade !== undefined) updates.unidade = unidade
  if (estoque_minimo !== undefined) updates.estoque_minimo = estoque_minimo
  if (ativo !== undefined) updates.ativo = ativo
  if (valor_venda !== undefined) updates.valor_venda = valor_venda
  const { error } = await supabase.from('produtos').update(updates).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar produto' })
  return res.json({ mensagem: 'Produto atualizado com sucesso' })
}

module.exports = { listar, buscarPorId, criar, atualizar, listarCategorias, criarCategoria, atualizarCategoria }
