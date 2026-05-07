async function resolver(req, res) {
  const { id } = req.params
  const { acao, motivo_rejeicao } = req.body
  if (!['aprovar', 'rejeitar'].includes(acao)) return res.status(400).json({ erro: 'acao deve ser aprovar ou rejeitar' })

  const { data: transferencia, error: erroBusca } = await supabase
    .from('transferencias')
    .select('id, status, produto_id, centro_origem_id, centro_destino_id, quantidade, quantidade_destino, unidade_destino, finalidade')
    .eq('id', id).single()

  if (erroBusca || !transferencia) return res.status(404).json({ erro: 'Transferencia nao encontrada' })
  if (transferencia.status !== 'pendente') return res.status(409).json({ erro: 'Transferencia ja resolvida' })

  if (acao === 'aprovar') {
    // Verifica se já existe movimentação de saída para esta transferência
    const { data: movsExistentes } = await supabase
      .from('movimentacoes')
      .select('id')
      .eq('documento', id)
      .eq('tipo', 'saida')

    const jaMovimentou = movsExistentes && movsExistentes.length > 0

    if (!jaMovimentou) {
      // Só verifica saldo e movimenta se ainda não foi feito
      const { data: posicao } = await supabase
        .from('posicoes_estoque').select('quantidade')
        .eq('produto_id', transferencia.produto_id)
        .eq('centro_id', transferencia.centro_origem_id).single()

      if ((posicao?.quantidade || 0) < transferencia.quantidade) {
        return res.status(422).json({ erro: 'Saldo insuficiente no momento da aprovacao' })
      }

      await supabase.from('movimentacoes').insert({
        produto_id: transferencia.produto_id,
        centro_id: transferencia.centro_origem_id,
        usuario_id: req.usuario.id,
        tipo: 'saida',
        quantidade: transferencia.quantidade,
        motivo: 'Transferencia aprovada #' + id,
        documento: id,
        finalidade: transferencia.finalidade
      })

      const qtdEntrada = transferencia.quantidade_destino || transferencia.quantidade
      await supabase.from('movimentacoes').insert({
        produto_id: transferencia.produto_id,
        centro_id: transferencia.centro_destino_id,
        usuario_id: req.usuario.id,
        tipo: 'entrada',
        quantidade: qtdEntrada,
        motivo: 'Transferencia aprovada #' + id,
        documento: id,
        finalidade: transferencia.finalidade,
        custo_unitario: null
      })
    }
  }

  const novoStatus = acao === 'aprovar' ? 'aprovada' : 'rejeitada'
  const { data, error } = await supabase
    .from('transferencias')
    .update({
      status: novoStatus,
      admin_id: req.usuario.id,
      motivo_rejeicao: acao === 'rejeitar' ? motivo_rejeicao : null
    })
    .eq('id', id).select().single()

  if (error) return res.status(500).json({ erro: 'Erro ao processar transferencia' })
  await registrarHistorico(req.usuario.id, 'transferencias', id, 'edicao', { status: 'pendente' }, { status: novoStatus, motivo_rejeicao })
  return res.json({ mensagem: 'Transferencia ' + novoStatus + ' com sucesso', transferencia: data })
}
