const bcrypt = require('bcryptjs')
const supabase = require('../lib/supabase')

async function listar(req, res) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, papel, ativo, criado_em')
    .order('nome')
  if (error) return res.status(500).json({ erro: 'Erro ao listar usuários' })
  return res.json(data)
}

async function buscarPorId(req, res) {
  const { id } = req.params
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, papel, ativo, criado_em')
    .eq('id', id)
    .single()

  if (error || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado' })

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
    return res.status(400).json({ erro: 'nome, email, senha e papel são obrigatórios' })
  }
  if (!['admin', 'operador'].includes(papel)) {
    return res.status(400).json({ erro: 'papel deve ser admin ou operador' })
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres' })
  }

  const senha_hash = await bcrypt.hash(senha, 10)

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .insert({ nome, email: email.toLowerCase(), senha_hash, papel })
    .select('id, nome, email, papel, ativo, criado_em')
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ erro: 'E-mail já cadastrado' })
    return res.status(500).json({ erro: 'Erro ao criar usuário' })
  }

  if (papel === 'operador' && Array.isArray(centros) && centros.length > 0) {
    const vinculos = centros.map(centro_id => ({ usuario_id: usuario.id, centro_id }))
    await supabase.from('acesso_centros').insert(vinculos)
  }

  return res.status(201).json(usuario)
}

async function atualizar(req, res) {
  const { id } = req.params
  const { nome, email, papel, ativo, centros } = req.body

  const updates = {}
  if (nome !== undefined) updates.nome = nome
  if (email !== undefined) updates.email = email.toLowerCase()
  if (papel !== undefined) updates.papel = papel
  if (ativo !== undefined) updates.ativo = ativo

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('usuarios').update(updates).eq('id', id)
    if (error) return res.status(500).json({ erro: 'Erro ao atualizar usuário' })
  }

  if (Array.isArray(centros)) {
    await supabase.from('acesso_centros').delete().eq('usuario_id', id)
    if (centros.length > 0) {
      const vinculos = centros.map(centro_id => ({ usuario_id: id, centro_id }))
      await supabase.from('acesso_centros').insert(vinculos)
    }
  }

  return res.json({ mensagem: 'Usuário atualizado com sucesso' })
}

async function remover(req, res) {
  const { id } = req.params
  const { error } = await supabase.from('usuarios').update({ ativo: false }).eq('id', id)
  if (error) return res.status(500).json({ erro: 'Erro ao remover usuário' })
  return res.json({ mensagem: 'Usuário desativado com sucesso' })
}

module.exports = { listar, buscarPorId, criar, atualizar, remover }
