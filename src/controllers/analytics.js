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

    const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']

    const porProduto = {}
    vendas.forEach(v => {
      if (!porProduto[v.produto_id]) {
        porProduto[v.produto_id] = {
          produto_id: v.produto_id,
          nome: v.produtos?.nome,
          unidade: v.produtos?.unidade,
          vendas: [],
          por_dia_semana: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
          contagem_dia_semana: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        }
      }
      const data = new Date(v.criado_em)
      const diaSemana = data.getDay()
      porProduto[v.produto_id].vendas.push({ quantidade: Number(v.quantidade), data })
      porProduto[v.produto_id].por_dia_semana[diaSemana] += Number(v.quantidade)
      porProduto[v.produto_id].contagem_dia_semana[diaSemana] += 1
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

      const consumoPorDiaSemana = Object.entries(p.por_dia_semana).map(([dia, total]) => ({
        dia: Number(dia),
        nome: diasSemana[Number(dia)],
        total: Number(total.toFixed(3)),
        media: p.contagem_dia_semana[dia] > 0 ? Number((total / p.contagem_dia_semana[dia]).toFixed(3)) : 0,
        ocorrencias: p.contagem_dia_semana[dia]
      }))

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
        consumo_por_dia_semana: consumoPorDiaSemana,
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

async function sugestaoCompras(req, res) {
  try {
    const { estoque_id } = req.query

    const { data: produtos, error: erroProdutos } = await supabase
      .from('produtos')
      .select('id, nome, unidade, estoque_minimo')
      .eq('ativo', true)

    if (erroProdutos) return res.status(500).json({ erro: 'Erro ao buscar produtos' })

    let posicaoQuery = supabase
      .from('vw_posicao_estoque')
      .select('produto_id, quantidade, estoque_id')

    if (estoque_id) posicaoQuery = posicaoQuery.eq('estoque_id', estoque_id)

    const { data: posicoes } = await posicaoQuery

    const umaSemanaAtras = new Date()
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7)

    let vendasQuery = supabase
      .from('vendas')
      .select('produto_id, quantidade, centros(estoque_id)')
      .gte('data_venda', umaSemanaAtras.toISOString().split('T')[0])

    const { data: vendasSemana } = await vendasQuery

    const estoqueMap = {}
    posicoes?.forEach(p => {
      if (!estoqueMap[p.produto_id]) estoqueMap[p.produto_id] = 0
      estoqueMap[p.produto_id] += Number(p.quantidade)
    })

    const vendasSemanaMap = {}
    vendasSemana?.forEach(v => {
      if (estoque_id && v.centros?.estoque_id !== estoque_id) return
      if (!vendasSemanaMap[v.produto_id]) vendasSemanaMap[v.produto_id] = 0
      vendasSemanaMap[v.produto_id] += Number(v.quantidade)
    })

    const sugestoes = produtos.map(p => {
      const estoqueAtual = estoqueMap[p.id] || 0
      const vendaSemanal = vendasSemanaMap[p.id] || 0
      const estoqueMinimo = Number(p.estoque_minimo) || 0
      const estoqueIdeal = estoqueMinimo + (vendaSemanal * 2)
      const quantidadeComprar = Math.max(0, estoqueIdeal - estoqueAtual)

      let prioridade = 'ok'
      if (estoqueAtual <= 0) prioridade = 'urgente'
      else if (estoqueAtual < estoqueMinimo) prioridade = 'alto'
      else if (estoqueAtual < estoqueIdeal) prioridade = 'medio'

      return {
        produto_id: p.id,
        nome: p.nome,
        unidade: p.unidade,
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMinimo,
        venda_semanal: vendaSemanal,
        estoque_ideal: Number(estoqueIdeal.toFixed(3)),
        quantidade_sugerida: Number(quantidadeComprar.toFixed(3)),
        prioridade
      }
    })
    .filter(s => s.prioridade !== 'ok')
    .sort((a, b) => {
      const ordem = { urgente: 0, alto: 1, medio: 2 }
      return ordem[a.prioridade] - ordem[b.prioridade]
    })

    return res.json(sugestoes)
  } catch (e) {
    console.error('ERRO SUGESTAO:', e)
    return res.status(500).json({ erro: 'Erro ao gerar sugestoes de compra' })
  }
}

module.exports = { mediaConsumo, sugestaoCompras }
