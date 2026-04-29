const supabase = require('../lib/supabase')

async function listarEstoques(req, res) {
  const { data, error } = await supabase
    .from('estoques').select('*, centros(id, nome, localizacao, ativo)').eq('ativo', true).order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar estoques' })
  return res.json(data)
}

async function criarEstoque(req, res) {
  const { nome, descricao } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' })
  const { data, error } = await supabase.from('estoques').insert({ nome, descricao }).select().single()
  if (error) return res.status(500).json({ erro: 'Erro ao criar estoque' })
  return res.status(201).json(data)
}

async function atualizarEstoque(req, res) {
  const { id } = req.params
  const { nome, descricao, ativo } = req.body
  const { error } = await supabase.from('estoques').update({ nome, descricao, ativo }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar estoque' })
  return res.json({ mensagem: 'Estoque atualizado' })
}

async function listarCentros(req, res) {
  const { estoque_id } = req.query
  let query = supabase.from('centros').select('*, estoques(id, nome)').eq('ativo', true).order('nome')
  if (req.usuario.papel === 'operador') {
    const { data: acessos } = await supabase
      .from('acesso_centros').select('centro_id').eq('usuario_id', req.usuario.id)
    const ids = (acessos || []).map(a => a.centro_id)
    if (ids.length === 0) return res.json([])
    query = query.in('id', ids)
  }
  if (estoque_id) query = query.eq('estoque_id', estoque_id)
  const { data, error } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar centros' })
  return res.json(data)
}

async function criarCentro(req, res) {
  const { estoque_id, nome, localizacao } = req.body
  if (!estoque_id || !nome) return res.status(400).json({ erro: 'estoque_id e nome sao obrigatorios' })
  const { data, error } = await supabase
    .from('centros').insert({ estoque_id, nome, localizacao }).select('*, estoques(nome)').single()
  if (error) return res.status(500).json({ erro: 'Erro ao criar centro' })
  return res.status(201).json(data)
}

async function atualizarCentro(req, res) {
  const { id } = req.params
  const { nome, localizacao, ativo } = req.body
  const { error } = await supabase.from('centros').update({ nome, localizacao, ativo }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar centro' })
  return res.json({ mensagem: 'Centro atualizado' })
}

async function posicaoEstoque(req, res) {
  const { centro_id, estoque_id, produto_id, abaixo_minimo } = req.query
  let query = supabase.from('vw_posicao_estoque').select('*').order('produto')
  if (req.usuario.papel === 'operador') {
    const { data: acessos } = await supabase
      .from('acesso_centros').select('centro_id').eq('usuario_id', req.usuario.id)
    const ids = (acessos || []).map(a => a.centro_id)
    if (ids.length === 0) return res.json([])
    query = query.in('centro_id', ids)
  }
  if (centro_id) query = query.eq('centro_id', centro_id)
  if (estoque_id) query = query.eq('estoque_id', estoque_id)
  if (produto_id) query = query.eq('produto_id', produto_id)
  if (abaixo_minimo === 'true') query = query.eq('abaixo_minimo', true)
  const { data, error } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao consultar posicao de estoque' })
  return res.json(data)
}

async function painelGeral(req, res) {
  const [
    { data: consolidado },
    { data: pendentes },
    { data: alertas },
  ] = await Promise.all([
    supabase.from('vw_consolidado_estoques').select('*').order('estoque').order('produto'),
    supabase.from('vw_transferencias_pendentes').select('*'),
    supabase.from('vw_posicao_estoque').select('*').eq('abaixo_minimo', true),
  ])
  return res.json({
    consolidado: consolidado || [],
    transferencias_pendentes: pendentes || [],
    alertas_estoque_baixo: alertas || [],
    resumo: {
      total_pendentes: pendentes?.length || 0,
      total_alertas: alertas?.length || 0,
    }
  })
}

module.exports = { listarEstoques, criarEstoque, atualizarEstoque, listarCentros, criarCentro, atualizarCentro, posicaoEstoque, painelGeral }
