const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { limite = 50, pagina = 1, data_inicio, data_fim } = req.query
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('vendas')
    .select(`id, quantidade, valor_unitario, valor_total, observacao, data_venda, criado_em, produtos(id, nome, unidade), centros(id, nome, estoques(nome)), usuarios(id, nome)`, { count: 'exact' })
    .order('data_venda', { ascending: false })
    .range(offset, offset + Number(limite) - 1)

  if (data_inicio) query = query.gte('data_venda', data_inicio)
  if (data_fim) query = query.lte('data_venda', data_fim)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar vendas' })
  return res.json({ dados: data, total: count, pagina: Number(pagina), limite: Number(limite) })
}

async function registrar(req, res) {
  const { produto_id, centro_id, quantidade, valor_unitario, observacao, data_venda } = req.body

  if (!produto_id || !centro_id || !quantidade || !valor_unitario) {
    return res.status(400).json({ erro: 'produto_id, centro_id, quantidade e valor_unitario sao obrigatorios' })
  }
  if (Number(quantidade) <= 0) {
    return res.status(400).json({ erro: 'Quantidade deve ser maior que zero' })
  }

  const qtdVenda = Number(quantidade)
  const valor_total = qtdVenda * Number(valor_unitario)

  // ── 1. Busca ficha técnica do produto ──────────────────────────────────
  const { data: ficha } = await supabase
    .from('fichas_tecnicas')
    .select('insumo_id, quantidade, unidade')
    .eq('produto_id', produto_id)

  const temFicha = ficha && ficha.length > 0

  // ── 2. Se tem ficha, verifica saldo de cada insumo antes de registrar ──
  if (temFicha) {
    for (const item of ficha) {
      const qtdNecessaria = item.quantidade * qtdVenda

      const { data: posicao } = await supabase
        .from('posicoes_estoque')
        .select('quantidade')
        .eq('produto_id', item.insumo_id)
        .eq('centro_id', centro_id)
        .single()

      const saldo = posicao?.quantidade || 0

      if (saldo < qtdNecessaria) {
        const { data: insumo } = await supabase
          .from('produtos')
          .select('nome')
          .eq('id', item.insumo_id)
          .single()

        return res.status(422).json({
          erro: `Saldo insuficiente para o insumo "${insumo?.nome || item.insumo_id}"`,
          insumo_id: item.insumo_id,
          saldo_disponivel: saldo,
          quantidade_necessaria: qtdNecessaria
        })
      }
    }
  }

  // ── 3. Registra a venda ────────────────────────────────────────────────
  const { data: venda, error: errVenda } = await supabase
    .from('vendas')
    .insert({
      produto_id,
      centro_id,
      usuario_id: req.usuario.id,
      quantidade: qtdVenda,
      valor_unitario: Number(valor_unitario),
      valor_total,
      observacao,
      data_venda: data_venda || new Date().toISOString().split('T')[0]
    })
    .select(`id, quantidade, valor_unitario, valor_total, observacao, data_venda, criado_em, produtos(nome, unidade), centros(nome, estoques(nome))`)
    .single()

  if (errVenda) {
    console.error('ERRO VENDA:', JSON.stringify(errVenda))
    return res.status(500).json({ erro: 'Erro ao registrar venda' })
  }

  // ── 4. Dá baixa automática nos insumos da ficha técnica ───────────────
  const saidasRegistradas = []
  if (temFicha) {
    for (const item of ficha) {
      const qtdBaixa = item.quantidade * qtdVenda

      const { data: mov, error: errMov } = await supabase
        .from('movimentacoes')
        .insert({
          produto_id: item.insumo_id,
          centro_id,
          usuario_id: req.usuario.id,
          tipo: 'saida',
          quantidade: qtdBaixa,
          motivo: `Venda automática — venda #${venda.id}`,
          documento: venda.id,
          finalidade: null
        })
        .select('id, quantidade, produto_id')
        .single()

      if (errMov) {
        console.error('ERRO BAIXA INSUMO:', JSON.stringify(errMov))
        // Não cancela a venda, mas avisa
      } else {
        saidasRegistradas.push(mov)
      }
    }
  }

  return res.status(201).json({
    venda,
    baixas_automaticas: saidasRegistradas,
    ficha_aplicada: temFicha
  })
}

async function remover(req, res) {
  const { id } = req.params
  const { error } = await supabase.from('vendas').delete().eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao remover venda' })
  return res.json({ mensagem: 'Venda removida com sucesso' })
}

module.exports = { listar, registrar, remover }
