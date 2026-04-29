const jwt = require('jsonwebtoken')
const supabase = require('../lib/supabase')

async function autenticar(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não informado' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, papel, ativo')
      .eq('id', payload.id)
      .single()

    if (error || !usuario) return res.status(401).json({ erro: 'Usuário não encontrado' })
    if (!usuario.ativo) return res.status(403).json({ erro: 'Usuário inativo' })

    req.usuario = usuario
    next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}

function somenteAdmin(req, res, next) {
  if (req.usuario.papel !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' })
  }
  next()
}

async function verificarAcessoCentro(req, res, next) {
  if (req.usuario.papel === 'admin') return next()

  const centro_id = req.body.centro_id || req.params.centro_id
  if (!centro_id) return res.status(400).json({ erro: 'centro_id é obrigatório' })

  const { data, error } = await supabase
    .from('acesso_centros')
    .select('id')
    .eq('usuario_id', req.usuario.id)
    .eq('centro_id', centro_id)
    .single()

  if (error || !data) {
    return res.status(403).json({ erro: 'Sem acesso a este centro de estoque' })
  }
  next()
}

module.exports = { autenticar, somenteAdmin, verificarAcessoCentro }
