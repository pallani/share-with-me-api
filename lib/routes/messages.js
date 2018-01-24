// Express
const express = require('express')
const router = express.Router()

// Express Middleware
const bodyParser = require('body-parser')
router.use(bodyParser.json())

// Moment
// const moment = require('moment-timezone')
// moment.tz.setDefault('Asia/Singapore')

// Lodash
// const _ = require('lodash')

// Environment variables
const FACEBOOK_VALIDATION_TOKEN = process.env.FACEBOOK_VALIDATION_TOKEN

// Route to validate webhook from Facebook UI
router.get('/messages', async (request, response) => {
  if (request.query['hub.mode'] === 'subscribe' &&
      request.query['hub.verify_token'] === FACEBOOK_VALIDATION_TOKEN) {
    console.log('Validating webhook')
    response.status(200).send(request.query['hub.challenge'])
  } else {
    console.error('Failed validation. Make sure the validation tokens match.')
    response.sendStatus(403)
  }
})

router.post('/messages', async (request, response) => {
  console.log(`Request Body: ${JSON.stringify(request.body, null, ' ')}`)
  response.status(200).json({status: 'ok'})
})

module.exports = router
