require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const routes = require('./src/routes/index')

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use('/api', routes)

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'EstoqueApp API rodando!' })
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
