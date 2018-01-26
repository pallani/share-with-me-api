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
const _ = require('lodash')

// Promise Library
const bluebird = require('bluebird')

// HTTP Client
const got = require('got')

// Environment variables
const FACEBOOK_VALIDATION_TOKEN = process.env.FACEBOOK_VALIDATION_TOKEN
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
const GOOGLE_SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)

// Firebase
const admin = require('firebase-admin')
const app = admin.initializeApp({
  credential: admin.credential.cert(GOOGLE_SERVICE_ACCOUNT_KEY),
  databaseURL: 'https://share-with-me-1e929.firebaseio.com'
})
const db = app.database()

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
    await got(
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

async function getSenderName (id) {
  try {
    let info = await got(
      `https://graph.facebook.com/v2.6/${id}`,
      {
        query: {
          fields: ['id', 'name'],
          access_token: FACEBOOK_PAGE_ACCESS_TOKEN
        },
        options: {
          method: 'GET'
        },
        json: true
      }
    )
    return info.body.name
    // console.log('Facebook Send API Response:', status)
  } catch (error) {
    console.log('Error while connecting to Graph API:', error)
  }
}

async function saveMessage (message) {
  try {
    await db.ref('messages').push().set(message)
  } catch (error) {
    console.log('Error saving message to firebase:', error)
  }
}

async function sendItemList (recipientId, items) {
  let message = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'You can borrow these items:',
          buttons: _.map(items, i => ({
            type: 'postback',
            title: _.capitalize(i.name),
            payload: JSON.stringify(i)
          }))
        }
      }
    }
  }

  try {
    await got(
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

async function logNotSure (message) {
  try {
    await db.ref('not_sure').push().set(message)
  } catch (error) {
    console.log('Error saving message to firebase:', error)
  }
}

async function getItems () {
  let itemsQuery = await db.ref('items').once('value')
  let items = itemsQuery.val()
  return _.map(items, (value, key) => _.assign(value, {firebaseKey: `items/${key}`}))
}

async function notSure (message) {
  await logNotSure(message)
  await sendMessage(message.sender.id, `Sorry I can't help you with that.`)
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
      // Save message to firebase
      await saveMessage(m)

      // Extract date from message
      let sender = m.sender.id
      // let recipient = m.recipient.id
      // let messageTimestamp = moment(m.timestamp)
      // let messageId = m.message.mid
      // let message = m.message.text

      // Save sender info
      // let name = await getSenderName(sender)
      // await sendMessage(sender, `You are ${name}.`)

      let nlp = m.message.nlp

      if (nlp &&
          nlp.entities &&
          _.has(nlp.entities, 'intent') &&
          nlp.entities.intent.length === 1) {
        let intent = nlp.entities.intent[0]
        switch (intent) {
          case 'intent_what-can-borrow':
            let items = await getItems()
            await sendItemList(sender, items)
            break
          default:
            await notSure(m)
            break
        }
      } else {
        await notSure(m)
      }
    })
  })
  response.status(200).json({status: 'ok'})
})

module.exports = router
