const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { centro_id, produto_id, tipo, data_inicio, data_fim, limite = 50, pagina = 1 } = req.query
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('movimentacoes')
    .select(`
      id, tipo, quantidade, motivo, documento, criado_em, data_validade, custo_unitario, custo_total, finalidade,
      produtos(id, sku, nome, unidade, tipo),
      centros(id, nome, estoques(nome)),
      usuarios(id, nome)
    `, { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + Number(limite) - 1)

  if (req.usuario.papel === 'operador') {
    const { data: acessos } = await supabase
      .from('acesso_centros')
      .select('centro_id')
      .eq('usuario_id', req.usuario.id)
    const ids = (acessos || []).map(a => a.centro_id)
    if (ids.length === 0) return res.json({ dados: [], total: 0 })
    query = query.in('centro_id', ids)
  }

  if (centro_id) query = query.eq('centro_id', centro_id)
  if (produto_id) query = query.eq('produto_id', produto_id)
  if (tipo) query = query.eq('tipo', tipo)
  if (data_inicio) query = query.gte('criado_em', data_inicio)
  if (data_fim) query = query.lte('criado_em', data_fim)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar movimentacoes' })
  return res.json({ dados: data, total: count, pagina: Number(pagina), limite: Number(limite) })
}

async function registrar(req, res) {
  const { produto_id, centro_id, tipo, quantidade, motivo, documento, custo_unitario, data_validade, finalidade } = req.body

  if (!produto_id || !centro_id || !tipo || !quantidade) {
    return res.status(400).json({ erro: 'produto_id, centro_id, tipo e quantidade sao obrigatorios' })
  }
  if (!['entrada', 'saida', 'ajuste'].includes(tipo)) {
    return res.status(400).json({ erro: 'tipo deve ser entrada, saida ou ajuste' })
  }
  if (Number(quantidade) <= 0) {
    return res.status(400).json({ erro: 'quantidade deve ser maior que zero' })
  }

  const { data: produto } = await supabase
    .from('produtos')
    .select('tipo')
    .eq('id', produto_id)
    .single()

  if (produto?.tipo === 'ambos' && !finalidade) {
    return res.status(400).json({ erro: 'Para produtos do tipo ambos, informe a finalidade (materia_prima ou revenda)' })
  }

  if (tipo === 'saida') {
    const { data: posicao } = await supabase
      .from('posicoes_estoque')
      .select('quantidade')
      .eq('produto_id', produto_id)
      .eq('centro_id', centro_id)
      .single()

    const saldo = posicao?.quantidade || 0
    if (saldo < Number(quantidade)) {
      return res.status(422).json({
        erro: 'Saldo insuficiente',
        saldo_disponivel: saldo,
        quantidade_solicitada: Number(quantidade)
      })
    }
  }

  const { data, error } = await supabase
    .from('movimentacoes')
    .insert({
      produto_id,
      centro_id,
      usuario_id: req.usuario.id,
      tipo,
      quantidade: Number(quantidade),
      motivo,
      documento,
      custo_unitario: custo_unitario ? Number(custo_unitario) : null,
      data_validade: data_validade || null,
      finalidade: produto?.tipo === 'ambos' ? finalidade : null,
    })
    .select(`
      id, tipo, quantidade, motivo, documento, criado_em, data_validade, custo_unitario, custo_total, finalidade,
      produtos(sku, nome, unidade, tipo),
      centros(nome, estoques(nome))
    `)
    .single()

  if (error) {
    console.error('ERRO MOVIMENTACAO:', JSON.stringify(error))
    return res.status(500).json({ erro: error.message || 'Erro ao registrar movimentacao' })
  }

  const { data: posicao } = await supabase
    .from('posicoes_estoque')
    .select('quantidade')
    .eq('produto_id', produto_id)
    .eq('centro_id', centro_id)
    .single()

  return res.status(201).json({
    movimentacao: data,
    saldo_atual: posicao?.quantidade || 0,
  })
}

async function alertasValidade(req, res) {
  const { dias = 30 } = req.query
  const hoje = new Date()
  const limite = new Date()
  limite.setDate(hoje.getDate() + Number(dias))

  const hojeStr = hoje.toISOString().split('T')[0]
  const limiteStr = limite.toISOString().split('T')[0]

  let query = supabase
    .from('movimentacoes')
    .select(`
      id, tipo, quantidade, data_validade, criado_em,
      produtos(id, nome, unidade),
      centros(id, nome, estoques(nome))
    `)
    .eq('tipo', 'entrada')
    .not('data_validade', 'is', null)
    .lte('data_validade', limiteStr)
    .gte('data_validade', hojeStr)
    .order('data_validade', { ascending: true })

  if (req.usuario.papel === 'operador') {
    const { data: acessos } = await supabase
      .from('acesso_centros')
      .select('centro_id')
      .eq('usuario_id', req.usuario.id)
    const ids = (acessos || []).map(a => a.centro_id)
    if (ids.length === 0) return res.json({ vencendo: [], vencidos: [] })
    query = query.in('centro_id', ids)
  }

  const { data } = await query

  const vencidos = await supabase
    .from('movimentacoes')
    .select(`id, tipo, quantidade, data_validade, criado_em, produtos(id, nome, unidade), centros(id, nome, estoques(nome))`)
    .eq('tipo', 'entrada')
    .not('data_validade', 'is', null)
    .lt('data_validade', hojeStr)
    .order('data_validade', { ascending: true })

  return res.json({
    vencendo: data || [],
    vencidos: vencidos.data || []
  })
}

module.exports = { listar, registrar, alertasValidade }
