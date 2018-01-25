// Express
const express = require('express')
const router = express.Router()

// Express Middleware
const bodyParser = require('body-parser')
router.use(bodyParser.json())

// Moment
const moment = require('moment-timezone')
moment.tz.setDefault('Asia/Singapore')

// Lodash
// const _ = require('lodash')

// Promise Library
const bluebird = require('bluebird')

// HTTP Client
const got = require('got')

// Environment variables
const FACEBOOK_VALIDATION_TOKEN = process.env.FACEBOOK_VALIDATION_TOKEN
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN

async function sendMessage (recipientId, messageText) {
  let message = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  }

  try {
    let status = await got(
      'https://graph.facebook.com/v2.6/me/messages',
      {
        query: { access_token: FACEBOOK_PAGE_ACCESS_TOKEN },
        options: {
          method: 'POST'
        },
        body: message,
        json: true
      }
    )
    // console.log('Facebook Send API Response:', status)
  } catch (error) {
    console.log('Error while connecting to Send API:', error)
  }
}

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
  let data = request.body
  console.log(`Request Body: ${JSON.stringify(data, null, ' ')}`)

  // Don't handle messages that are not from a page subscription
  if (data.object !== 'page') {
    response.status(200).json({status: 'ok'})
  }

  // Messages may be batched so handle each of them
  console.log(`Number of messages: ${data.entry.length}`)
  await bluebird.each(data.entry, async (e) => {
    // let pageId = e.id
    // let eventTimestamp = moment(e.time)

    // Each message can have muliple events
    await bluebird.each(e.messaging, async (m) => {
      let sender = m.sender.id
      // let recipient = m.recipient.id
      // let messageTimestamp = moment(m.timestamp)
      // let messageId = m.message.mid
      let message = m.message.text
      await sendMessage(sender, `ECHO: ${message}`)
    })
  })
  response.status(200).json({status: 'ok'})
})

module.exports = router
