const supabase = require('../lib/supabase')

// Lista todos os insumos da ficha técnica de um produto
async function listar(req, res) {
  const { produto_id } = req.params

  const { data, error } = await supabase
    .from('fichas_tecnicas')
    .select(`
      id, quantidade, unidade, observacao,
      insumos:insumo_id (id, nome, unidade, tipo)
    `)
    .eq('produto_id', produto_id)
    .order('criado_em')

  if (error) return res.status(500).json({ erro: 'Erro ao buscar ficha tecnica' })
  return res.json(data)
}

// Salva a ficha técnica completa de um produto (substitui os itens)
async function salvar(req, res) {
  const { produto_id } = req.params
  const { itens } = req.body

  if (!Array.isArray(itens)) {
    return res.status(400).json({ erro: 'itens deve ser um array' })
  }

  for (const item of itens) {
    if (!item.insumo_id || !item.quantidade || Number(item.quantidade) <= 0) {
      return res.status(400).json({ erro: 'Cada item deve ter insumo_id e quantidade > 0' })
    }
  }

  const { error: delError } = await supabase
    .from('fichas_tecnicas')
    .delete()
    .eq('produto_id', produto_id)

  if (delError) return res.status(500).json({ erro: 'Erro ao atualizar ficha tecnica' })

  if (itens.length === 0) {
    return res.json({ mensagem: 'Ficha tecnica limpa com sucesso' })
  }

  const registros = itens.map(item => ({
    produto_id,
    insumo_id: item.insumo_id,
    quantidade: Number(item.quantidade),
    unidade: item.unidade || 'un',
    observacao: item.observacao || null
  }))

  const { data, error } = await supabase
    .from('fichas_tecnicas')
    .insert(registros)
    .select(`
      id, quantidade, unidade, observacao,
      insumos:insumo_id (id, nome, unidade, tipo)
    `)

  if (error) return res.status(500).json({ erro: 'Erro ao salvar ficha tecnica' })
  return res.status(201).json(data)
}

// Remove um item específico da ficha
async function removerItem(req, res) {
  const { id } = req.params
  const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao remover item da ficha' })
  return res.json({ mensagem: 'Item removido' })
}

module.exports = { listar, salvar, removerItem }
