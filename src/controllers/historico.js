const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { tabela, limite = 50, pagina = 1 } = req.query
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('historico_alteracoes')
    .select(`
      id, tabela, registro_id, acao, dados_anteriores, dados_novos, criado_em,
      usuarios(id, nome)
    `, { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + Number(limite) - 1)

  if (tabela) query = query.eq('tabela', tabela)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ erro: 'Erro ao listar historico' })
  return res.json({ dados: data, total: count, pagina: Number(pagina), limite: Number(limite) })
}

async function registrar(usuario_id, tabela, registro_id, acao, dados_anteriores, dados_novos) {
  await supabase.from('historico_alteracoes').insert({
    usuario_id,
    tabela,
    registro_id,
    acao,
    dados_anteriores,
    dados_novos
  })
}

module.exports = { listar, registrar }
