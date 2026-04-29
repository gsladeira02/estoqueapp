const supabase = require('../lib/supabase')

async function listarCategorias(req, res) {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar categorias' })
  return res.json(data)
}

async function criarCategoria(req, res) {
  const { nome, descricao } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' })
  const { data, error } = await supabase
    .from('categorias')
    .insert({ nome, descricao })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Categoria já existe' })
    return res.status(500).json({ erro: 'Erro ao criar categoria' })
  }
  return res.status(201).json(data)
}

async function atualizarCategoria(req, res) {
  const { id } = req.params
  const { nome, descricao, ativo } = req.body
  const { error } = await supabase.from('categorias').update({ nome, descricao, ativo }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar categoria' })
  return res.json({ mensagem: 'Categoria atualizada' })
}

async function listar(req, res) {
  const { categoria_id, tipo, ativo = 'true', busca } = req.query
  let query = supabase
    .from('produtos')
    .select('*, categorias(id, nome)')
    .order('nome')
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
    .from('produtos')
    .select('*, categorias(id, nome)')
    .eq('id', id)
    .single()
  if (error || !produto) return res.status(404).json({ erro: 'Produto não encontrado' })
  const { data: posicoes } = await supabase
    .from('vw_posicao_estoque')
    .select('*')
    .eq('produto_id', id)
  return res.json({ ...produto, posicoes: posicoes || [] })
}

async function criar(req, res) {
  const { sku, nome, descricao, categoria_id, tipo, unidade, estoque_minimo } = req.body
  if (!sku || !nome || !categoria_id || !tipo) {
    return res.status(400).json({ erro: 'sku, nome, categoria_id e tipo são obrigatórios' })
  }
  if (!['materia_prima', 'revenda', 'ambos'].includes(tipo)) {
    return res.status(400).json({ erro: 'tipo deve ser materia_prima, revenda ou ambos' })
  }
  const { data, error } = await supabase
    .from('produtos')
    .insert({ sku, nome, descricao, categoria_id, tipo, unidade: unidade || 'un', estoque_minimo: estoque_minimo || 0 })
