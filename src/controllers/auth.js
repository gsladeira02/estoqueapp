const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const supabase = require('../lib/supabase')

async function login(req, res) {
  const { email, senha } = req.body
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' })

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, papel, senha_hash, ativo')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !usuario) return res.status(401).json({ erro: 'Credenciais inválidas' })
  if (!usuario.ativo) return res.status(403).json({ erro: 'Usuário inativo' })

  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash)
  if (!senhaOk) return res.status(401).json({ erro: 'Credenciais inválidas' })

  let centros = []
  if (usuario.papel === 'operador') {
    const { data } = await supabase
      .from('acesso_centros')
      .select('centro_id, centros(id, nome, estoque_id, estoques(nome))')
      .eq('usuario_id', usuario.id)
    centros = data || []
  }

  const token = jwt.sign(
    { id: usuario.id, papel: usuario.papel },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )

  return res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      centros,
    },
  })
}

async function meuPerfil(req, res) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, papel, criado_em')
    .eq('id', req.usuario.id)
    .single()

  if (error) return res.status(500).json({ erro: 'Erro ao buscar perfil' })
  return res.json(data)
}

async function alterarSenha(req, res) {
  const { senha_atual, nova_senha } = req.body
  if (!senha_atual || !nova_senha) return res.status(400).json({ erro: 'Campos obrigatórios' })
  if (nova_senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres' })

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('senha_hash')
    .eq('id', req.usuario.id)
    .single()

  const senhaOk = await bcrypt.compare(senha_atual, usuario.senha_hash)
  if (!senhaOk) return res.status(401).json({ erro: 'Senha atual incorreta' })

  const hash = await bcrypt.hash(nova_senha, 10)
  await supabase.from('usuarios').update({ senha_hash: hash }).eq('id', req.usuario.id)

  return res.json({ mensagem: 'Senha alterada com sucesso' })
}

module.exports = { login, meuPerfil, alterarSenha }
