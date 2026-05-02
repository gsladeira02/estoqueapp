const express = require('express')
const router = express.Router()

const { autenticar, somenteAdmin, verificarAcessoCentro } = require('../middleware/auth')

const auth = require('../controllers/auth')
const usuarios = require('../controllers/usuarios')
const produtos = require('../controllers/produtos')
const movimentacoes = require('../controllers/movimentacoes')
const transferencias = require('../controllers/transferencias')
const estoques = require('../controllers/estoques')
const vendas = require('../controllers/vendas')
const historico = require('../controllers/historico')
const analytics = require('../controllers/analytics')

router.post('/auth/login', auth.login)
router.get('/auth/perfil', autenticar, auth.meuPerfil)
router.put('/auth/senha', autenticar, auth.alterarSenha)

router.get('/usuarios', autenticar, somenteAdmin, usuarios.listar)
router.get('/usuarios/:id', autenticar, somenteAdmin, usuarios.buscarPorId)
router.post('/usuarios', autenticar, somenteAdmin, usuarios.criar)
router.put('/usuarios/:id', autenticar, somenteAdmin, usuarios.atualizar)
router.delete('/usuarios/:id', autenticar, somenteAdmin, usuarios.remover)

router.get('/categorias', autenticar, produtos.listarCategorias)
router.post('/categorias', autenticar, somenteAdmin, produtos.criarCategoria)
router.put('/categorias/:id', autenticar, somenteAdmin, produtos.atualizarCategoria)

router.get('/produtos', autenticar, produtos.listar)
router.get('/produtos/:id', autenticar, produtos.buscarPorId)
router.post('/produtos', autenticar, somenteAdmin, produtos.criar)
router.put('/produtos/:id', autenticar, somenteAdmin, produtos.atualizar)

router.get('/estoques', autenticar, estoques.listarEstoques)
router.post('/estoques', autenticar, somenteAdmin, estoques.criarEstoque)
router.put('/estoques/:id', autenticar, somenteAdmin, estoques.atualizarEstoque)

router.get('/centros', autenticar, estoques.listarCentros)
router.post('/centros', autenticar, somenteAdmin, estoques.criarCentro)
router.put('/centros/:id', autenticar, somenteAdmin, estoques.atualizarCentro)

router.get('/posicao', autenticar, estoques.posicaoEstoque)
router.get('/painel', autenticar, somenteAdmin, estoques.painelGeral)

router.get('/movimentacoes/alertas-validade', autenticar, movimentacoes.alertasValidade)
router.get('/movimentacoes', autenticar, movimentacoes.listar)
router.post('/movimentacoes', autenticar, verificarAcessoCentro, movimentacoes.registrar)

router.get('/transferencias', autenticar, transferencias.listar)
router.post('/transferencias', autenticar, transferencias.solicitar)
router.patch('/transferencias/:id/resolver', autenticar, somenteAdmin, transferencias.resolver)
router.patch('/transferencias/:id/cancelar', autenticar, transferencias.cancelar)

router.get('/vendas', autenticar, somenteAdmin, vendas.listar)
router.post('/vendas', autenticar, somenteAdmin, vendas.registrar)
router.delete('/vendas/:id', autenticar, somenteAdmin, vendas.remover)

router.get('/historico', autenticar, somenteAdmin, historico.listar)

router.get('/analytics/media-consumo', autenticar, somenteAdmin, analytics.mediaConsumo)
router.get('/analytics/sugestao-compras', autenticar, somenteAdmin, analytics.sugestaoCompras)

module.exports = router
