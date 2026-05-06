// src/controllers/produtos.js
const supabase = require('../lib/supabase')
const { registrar: registrarHistorico } = require('./historico')

async function listarCategorias(req, res) {
  const { data, error } = await supabase.from('categorias').select('*').eq('ativo', true).order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar categorias' })
  return res.json(data)
}

async function criarCategoria(req, res) {
  const { nome, descricao } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' })
  const { data, error } = await supabase.from('categorias').insert({ nome, descricao }).select().single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Categoria ja existe' })
    return res.status(500).json({ erro: 'Erro ao criar categoria' })
  }
  await registrarHistorico(req.usuario.id, 'categorias', data.id, 'criacao', null, { nome })
  return res.status(201).json(data)
}

async function atualizarCategoria(req, res) {
  const { id } = req.params
  const { nome, descricao, ativo } = req.body
  const { error } = await supabase.from('categorias').update({ nome, descricao, ativo }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar categoria' })
  await registrarHistorico(req.usuario.id, 'categorias', id, 'edicao', null, { nome, descricao, ativo })
  return res.json({ mensagem: 'Categoria atualizada' })
}

async function listar(req, res) {
  const { categoria_id, tipo, ativo = 'true', busca, eh_produto_venda } = req.query
  let query = supabase.from('produtos').select('*, categorias(id, nome)').order('nome')
  if (ativo !== 'todos') query = query.eq('ativo', ativo === 'true')
  if (categoria_id) query = query.eq('categoria_id', categoria_id)
  if (tipo) query = query.eq('tipo', tipo)
  if (eh_produto_venda !== undefined) query = query.eq('eh_produto_venda', eh_produto_venda === 'true')
  if (busca) query = query.or('nome.ilike.%' + busca + '%,sku.ilike.%' + busca + '%')
  const { data, error } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar produtos' })
  return res.json(data)
}

async function buscarPorId(req, res) {
  const { id } = req.params
  const { data: produto, error } = await supabase.from('produtos').select('*, categorias(id, nome)').eq('id', id).single()
  if (error || !produto) return res.status(404).json({ erro: 'Produto nao encontrado' })
  const { data: posicoes } = await supabase.from('vw_posicao_estoque').select('*').eq('produto_id', id)
  return res.json({ ...produto, posicoes: posicoes || [] })
}

async function criar(req, res) {
  const { sku, nome, descricao, categoria_id, tipo, unidade, estoque_minimo, valor_venda, dias_validade, unidade_insumo, fator_conversao, eh_produto_venda } = req.body
  if (!sku || !nome || !categoria_id || !tipo) {
    return res.status(400).json({ erro: 'sku, nome, categoria_id e tipo sao obrigatorios' })
  }
  if (!['materia_prima', 'revenda', 'ambos'].includes(tipo)) {
    return res.status(400).json({ erro: 'tipo deve ser materia_prima, revenda ou ambos' })
  }
  const { data, error } = await supabase
    .from('produtos')
    .insert({
      sku, nome, descricao, categoria_id, tipo,
      unidade: unidade || 'un',
      estoque_minimo: estoque_minimo || 0,
      valor_venda: valor_venda || 0,
      dias_validade: dias_validade || null,
      unidade_insumo: unidade_insumo || null,
      fator_conversao: fator_conversao ? Number(fator_conversao) : null,
      eh_produto_venda: eh_produto_venda === true || eh_produto_venda === 'true' || false
    })
    .select('*, categorias(id, nome)').single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'SKU ja cadastrado' })
    return res.status(500).json({ erro: 'Erro ao criar produto' })
  }
  await registrarHistorico(req.usuario.id, 'produtos', data.id, 'criacao', null, { nome, tipo, unidade })
  return res.status(201).json(data)
}

async function atualizar(req, res) {
  const { id } = req.params
  const { sku, nome, descricao, categoria_id, tipo, unidade, estoque_minimo, ativo, valor_venda, dias_validade, unidade_insumo, fator_conversao, eh_produto_venda } = req.body
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
  if (dias_validade !== undefined) updates.dias_validade = dias_validade || null
  if (unidade_insumo !== undefined) updates.unidade_insumo = unidade_insumo || null
  if (fator_conversao !== undefined) updates.fator_conversao = fator_conversao ? Number(fator_conversao) : null
  if (eh_produto_venda !== undefined) updates.eh_produto_venda = eh_produto_venda === true || eh_produto_venda === 'true'

  const { data: anterior } = await supabase.from('produtos').select('*').eq('id', id).single()
  const { error } = await supabase.from('produtos').update(updates).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar produto' })
  await registrarHistorico(req.usuario.id, 'produtos', id, 'edicao', anterior, updates)
  return res.json({ mensagem: 'Produto atualizado com sucesso' })
}

module.exports = { listar, buscarPorId, criar, atualizar, listarCategorias, criarCategoria, atualizarCategoria }
