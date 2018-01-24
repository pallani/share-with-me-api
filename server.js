// Express
const express = require('express')
const app = express()

// Express Middleware
app.use(require('cors')())
app.use(require('compression')())

// Intercept ping requests for health checks
app.use((request, response, next) => {
  if (request.url === '/ping') {
    response.status(200).json({ message: 'I\'m ok!' })
  } else {
    next()
  }
})

// Express Routes
const messages = require('./lib/routes/messages')

// Express Route Binding
app.use('/v1', messages)

const serverPort = process.env.PORT || 10000

app.listen(serverPort, () => {
  console.log(`share-with-me-api server listening at ${serverPort}`)
})
