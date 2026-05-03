const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { data, error } = await supabase
    .from('categorias_venda').select('*').eq('ativo', true).order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar categorias de venda' })
  return res.json(data)
}

async function criar(req, res) {
  const { nome, descricao } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' })
  const { data, error } = await supabase
    .from('categorias_venda').insert({ nome, descricao }).select().single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'Categoria ja existe' })
    return res.status(500).json({ erro: 'Erro ao criar categoria' })
  }
  return res.status(201).json(data)
}

async function atualizar(req, res) {
  const { id } = req.params
  const { nome, descricao, ativo } = req.body
  const { error } = await supabase
    .from('categorias_venda').update({ nome, descricao, ativo }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao atualizar categoria' })
  return res.json({ mensagem: 'Categoria atualizada' })
}

module.exports = { listar, criar, atualizar }
