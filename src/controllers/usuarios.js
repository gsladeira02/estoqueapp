const bcrypt = require('bcryptjs')
const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, papel, ativo, criado_em')
    .order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar usuarios' })
  return res.json(data)
}

async function buscarPorId(req, res) {
  const { id } = req.params
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, papel, ativo, criado_em')
    .eq('id', id)
    .single()
  if (error || !usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' })
  let centros = []
  if (usuario.papel === 'operador') {
    const { data } = await supabase
      .from('acesso_centros')
      .select('centro_id, centros(id, nome, estoque_id, estoques(nome))')
      .eq('usuario_id', id)
    centros = data || []
  }
  return res.json({ ...usuario, centros })
}

async function criar(req, res) {
  const { nome, email, senha, papel, centros } = req.body
  if (!nome || !email || !senha || !papel) {
    return res.status(400).json({ erro: 'nome, email, senha e papel sao obrigatorios' })
  }
  if (!['admin', 'operador'].includes(papel)) {
    return res.status(400).json({ erro: 'papel deve ser admin ou operador' })
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'Senha deve ter no minimo 6 caracteres' })
  }
  const senha_hash = await bcrypt.hash(senha, 10)
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .insert({ nome, email: email.toLowerCase(), senha_hash, papel })
    .select('id, nome, email, papel, ativo, criado_em')
    .single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'E-mail ja cadastrado' })
    return res.status(500).json({ erro: 'Erro ao criar usuario' })
  }
  if (papel === 'operador' && Array.isArray(centros) && centros.length > 0) {
    const vinculos = centros.map(centro_id => ({ usuario_id: usuario.id, centro_id }))
    await supabase.from('acesso_centros').insert(vinculos)
  }
  return res.status(201).json(usuario)
}

async function atualizar(req, res) {
  const { id } = req.params
  const { nome, email, papel, ativo, centros, senha } = req.body
  const updates = {}
  if (nome !== undefined) updates.nome = nome
  if (email !== undefined) updates.email = email.toLowerCase()
  if (papel !== undefined) updates.papel = papel
  if (ativo !== undefined) updates.ativo = ativo
  if (senha) updates.senha_hash = await bcrypt.hash(senha, 10)
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('usuarios').update(updates).eq('id', id)
    if (error) return res.status(500).json({ erro: 'Erro ao atualizar usuario' })
  }
  if (Array.isArray(centros)) {
    await supabase.from('acesso_centros').delete().eq('usuario_id', id)
    if (centros.length > 0) {
      const vinculos = centros.map(centro_id => ({ usuario_id: id, centro_id }))
      await supabase.from('acesso_centros').insert(vinculos)
    }
  }
  return res.json({ mensagem: 'Usuario atualizado com sucesso' })
}

async function remover(req, res) {
  const { id } = req.params

  // Remove vínculos de acesso a centros
  await supabase.from('acesso_centros').delete().eq('usuario_id', id)

  // Anula referências nas outras tabelas
  await supabase.from('transferencias').update({ solicitante_id: null }).eq('solicitante_id', id)
  await supabase.from('transferencias').update({ admin_id: null }).eq('admin_id', id)
  await supabase.from('movimentacoes').update({ usuario_id: null }).eq('usuario_id', id)
  await supabase.from('vendas').update({ usuario_id: null }).eq('usuario_id', id)
  await supabase.from('historico_alteracoes').update({ usuario_id: null }).eq('usuario_id', id)

  // Apaga o usuario
  const { error } = await supabase.from('usuarios').delete().eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao apagar usuario: ' + error.message })
  return res.json({ mensagem: 'Usuario apagado com sucesso' })
}

module.exports = { listar, buscarPorId, criar, atualizar, remover }
