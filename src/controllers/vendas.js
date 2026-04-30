const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { limite = 50, pagina = 1 } = req.query
  const offset = (pagina - 1) * limite

  const { data, error, count } = await supabase
    .from('vendas')
    .select(`
      id, quantidade, valor_unitario, valor_total, observacao, criado_em,
      produtos(id, nome, unidade),
      centros(id, nome, estoques(nome)),
      usuarios(id, nome)
    `, { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + Number(limite) - 1)

  if (error) return res.status(500).json({ erro: 'Erro ao listar vendas' })
  return res.json({ dados: data, total: count, pagina: Number(pagina), limite: Number(limite) })
}

async function registrar(req, res) {
  const { produto_id, centro_id, quantidade, valor_unitario, observacao } = req.body

  if (!produto_id || !centro_id || !quantidade || !valor_unitario) {
    return res.status(400).json({ erro: 'produto_id, centro_id, quantidade e valor_unitario sao obrigatorios' })
  }
  if (Number(quantidade) <= 0) {
    return res.status(400).json({ erro: 'Quantidade deve ser maior que zero' })
  }

  const valor_total = Number(quantidade) * Number(valor_unitario)

  const { data, error } = await supabase
    .from('vendas')
    .insert({
      produto_id,
      centro_id,
      usuario_id: req.usuario.id,
      quantidade: Number(quantidade),
      valor_unitario: Number(valor_unitario),
      valor_total,
      observacao,
    })
    .select(`
      id, quantidade, valor_unitario, valor_total, observacao, criado_em,
      produtos(nome, unidade),
      centros(nome, estoques(nome))
    `)
    .single()

  if (error) {
    console.error('ERRO VENDA:', JSON.stringify(error))
    return res.status(500).json({ erro: 'Erro ao registrar venda' })
  }

  return res.status(201).json(data)
}

async function remover(req, res) {
  const { id } = req.params
  const { error } = await supabase.from('vendas').delete().eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao remover venda' })
  return res.json({ mensagem: 'Venda removida com sucesso' })
}

module.exports = { listar, registrar, remover }
