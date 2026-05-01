const supabase = require('../lib/supabase')

async function mediaConsumo(req, res) {
  try {
    const { data: vendas, error } = await supabase
      .from('vendas')
      .select('produto_id, quantidade, criado_em, produtos(id, nome, unidade)')
      .order('criado_em', { ascending: true })

    if (error) return res.status(500).json({ erro: 'Erro ao buscar vendas' })
    if (!vendas || vendas.length === 0) return res.json([])

    const { data: posicoes } = await supabase
      .from('vw_posicao_estoque')
      .select('produto_id, produto, unidade, quantidade')

    const porProduto = {}
    vendas.forEach(v => {
      if (!porProduto[v.produto_id]) {
        porProduto[v.produto_id] = {
          produto_id: v.produto_id,
          nome: v.produtos?.nome,
          unidade: v.produtos?.unidade,
          vendas: []
        }
      }
      porProduto[v.produto_id].vendas.push({
        quantidade: Number(v.quantidade),
        data: new Date(v.criado_em)
      })
    })

    const hoje = new Date()
    const resultado = Object.values(porProduto).map(p => {
      const totalVendido = p.vendas.reduce((acc, v) => acc + v.quantidade, 0)
      const primeiraVenda = p.vendas[0].data
      const diasTotal = Math.max(1, Math.ceil((hoje - primeiraVenda) / (1000 * 60 * 60 * 24)))

      const mediaDiaria = totalVendido / diasTotal
      const mediaSemanal = mediaDiaria * 7
      const mediaMensal = mediaDiaria * 30

      const posicao = posicoes?.filter(pos => pos.produto_id === p.produto_id)
      const estoqueAtual = posicao?.reduce((acc, pos) => acc + Number(pos.quantidade), 0) || 0

      const diasRestantes = mediaDiaria > 0 ? Math.floor(estoqueAtual / mediaDiaria) : null
      const previsaoFim = diasRestantes !== null
        ? new Date(hoje.getTime() + diasRestantes * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null

      return {
        produto_id: p.produto_id,
        nome: p.nome,
        unidade: p.unidade,
        total_vendido: totalVendido,
        estoque_atual: estoqueAtual,
        media_diaria: Number(mediaDiaria.toFixed(3)),
        media_semanal: Number(mediaSemanal.toFixed(3)),
        media_mensal: Number(mediaMensal.toFixed(3)),
        dias_restantes: diasRestantes,
        previsao_fim: previsaoFim,
        status: diasRestantes === null ? 'sem_consumo'
          : diasRestantes <= 7 ? 'critico'
          : diasRestantes <= 30 ? 'atencao'
          : 'normal'
      }
    })

    resultado.sort((a, b) => {
      if (a.dias_restantes === null) return 1
      if (b.dias_restantes === null) return -1
      return a.dias_restantes - b.dias_restantes
    })

    return res.json(resultado)
  } catch (e) {
    console.error('ERRO ANALYTICS:', e)
    return res.status(500).json({ erro: 'Erro ao calcular media de consumo' })
  }
}

module.exports = { mediaConsumo }
