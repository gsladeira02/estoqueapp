const supabase = require('../lib/supabase')
const { registrar: registrarHistorico } = require('./historico')

async function listar(req, res) {
  const { limite = 50, pagina = 1, data_inicio, data_fim } = req.query
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('producoes')
    .select(`
      id, observacao, perda_quantidade, perda_unidade, perda_motivo, criado_em,
      centros(id, nome, estoques(nome)),
      usuarios(id, nome),
      producao_insumos(id, quantidade, unidade, produtos(id, nome, unidade)),
      producao_produtos(id, quantidade, unidade, unidades_por_bolsa, produtos(id, nome, unidade, dias_validade))
    `, { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + Number(limite) - 1)

  if (data_inicio) query = query.gte('criado_em', data_inicio)
  if (data_fim) query = query.lte('criado_em', data_fim + 'T23:59:59')

  const { data, error, count } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar producoes' })
  return res.json({ dados: data, total: count, pagina: Number(pagina), limite: Number(limite) })
}

async function registrar(req, res) {
  const { centro_id, insumos, produtos_gerados, perda_quantidade, perda_unidade, perda_motivo, observacao } = req.body

  if (!centro_id) return res.status(400).json({ erro: 'centro_id e obrigatorio' })
  if (!Array.isArray(insumos) || insumos.length === 0) return res.status(400).json({ erro: 'Informe ao menos um insumo' })
  if (!Array.isArray(produtos_gerados) || produtos_gerados.length === 0) return res.status(400).json({ erro: 'Informe ao menos um produto gerado' })

  for (const insumo of insumos) {
    if (!insumo.produto_id || !insumo.quantidade || Number(insumo.quantidade) <= 0) {
      return res.status(400).json({ erro: 'Cada insumo precisa de produto_id e quantidade > 0' })
    }
    const { data: posicao } = await supabase
      .from('posicoes_estoque').select('quantidade')
      .eq('produto_id', insumo.produto_id).eq('centro_id', centro_id).single()
    const saldo = posicao?.quantidade || 0
    if (saldo < Number(insumo.quantidade)) {
      const { data: prod } = await supabase.from('produtos').select('nome').eq('id', insumo.produto_id).single()
      return res.status(422).json({
        erro: `Saldo insuficiente para "${prod?.nome}"`,
        saldo_disponivel: saldo,
        quantidade_necessaria: Number(insumo.quantidade)
      })
    }
  }

  const { data: producao, error: erroProd } = await supabase
    .from('producoes')
    .insert({
      centro_id,
      usuario_id: req.usuario.id,
      observacao: observacao || null,
      perda_quantidade: perda_quantidade ? Number(perda_quantidade) : null,
      perda_unidade: perda_unidade || null,
      perda_motivo: perda_motivo || null
    })
    .select('id').single()

  if (erroProd) return res.status(500).json({ erro: 'Erro ao criar producao' })

  await supabase.from('producao_insumos').insert(
    insumos.map(i => ({
      producao_id: producao.id,
      produto_id: i.produto_id,
      quantidade: Number(i.quantidade),
      unidade: i.unidade
    }))
  )

  await supabase.from('producao_produtos').insert(
    produtos_gerados.map(p => ({
      producao_id: producao.id,
      produto_id: p.produto_id,
      quantidade: Number(p.quantidade),
      unidade: p.unidade || 'un',
      unidades_por_bolsa: Number(p.unidades_por_bolsa) || 10
    }))
  )

  for (const insumo of insumos) {
    await supabase.from('movimentacoes').insert({
      produto_id: insumo.produto_id,
      centro_id,
      usuario_id: req.usuario.id,
      tipo: 'saida',
      quantidade: Number(insumo.quantidade),
      motivo: 'Producao #' + producao.id,
      documento: producao.id
    })
  }

  for (const prod of produtos_gerados) {
    await supabase.from('movimentacoes').insert({
      produto_id: prod.produto_id,
      centro_id,
      usuario_id: req.usuario.id,
      tipo: 'entrada',
      quantidade: Number(prod.quantidade),
      motivo: 'Producao #' + producao.id,
      documento: producao.id,
      data_validade: prod.data_validade || null
    })
  }

  await registrarHistorico(req.usuario.id, 'producoes', producao.id, 'criacao', null, { centro_id, insumos: insumos.length, produtos_gerados: produtos_gerados.length })

  const { data: completa } = await supabase
    .from('producoes')
    .select(`
      id, observacao, perda_quantidade, perda_unidade, perda_motivo, criado_em,
      centros(id, nome, estoques(nome)),
      usuarios(id, nome),
      producao_insumos(id, quantidade, unidade, produtos(id, nome, unidade)),
      producao_produtos(id, quantidade, unidade, unidades_por_bolsa, produtos(id, nome, unidade, dias_validade))
    `)
    .eq('id', producao.id).single()

  return res.status(201).json(completa)
}

async function remover(req, res) {
  const { id } = req.params

  const { data: producao } = await supabase
    .from('producoes')
    .select(`centro_id, producao_insumos(produto_id, quantidade), producao_produtos(produto_id, quantidade)`)
    .eq('id', id).single()

  if (!producao) return res.status(404).json({ erro: 'Producao nao encontrada' })

  for (const insumo of producao.producao_insumos) {
    await supabase.from('movimentacoes').insert({
      produto_id: insumo.produto_id,
      centro_id: producao.centro_id,
      usuario_id: req.usuario.id,
      tipo: 'entrada',
      quantidade: insumo.quantidade,
      motivo: 'Estorno producao #' + id,
      documento: id
    })
  }

  for (const prod of producao.producao_produtos) {
    await supabase.from('movimentacoes').insert({
      produto_id: prod.produto_id,
      centro_id: producao.centro_id,
      usuario_id: req.usuario.id,
      tipo: 'saida',
      quantidade: prod.quantidade,
      motivo: 'Estorno producao #' + id,
      documento: id
    })
  }

  await supabase.from('movimentacoes').delete().eq('documento', id)
  await supabase.from('producoes').delete().eq('id', id)

  return res.json({ mensagem: 'Producao removida e estoque estornado' })
}

module.exports = { listar, registrar, remover }
