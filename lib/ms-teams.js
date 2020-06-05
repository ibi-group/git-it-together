const moment = require('moment')
const request = require('request')

const webhook = process.env.MS_TEAMS_WEBHOOK

if (!webhook) {
  throw new Error('MS_TEAMS_WEBHOOK must be defined!')
}

/**
 * Send a message to MS Teams using a webhook. This will generate a card
 * according to the following schema:
 * https://docs.microsoft.com/en-us/outlook/actionable-messages/message-card-reference#openuri-action
 *
 * @param  {String} text  Contents of MS Teams message
 */
module.exports.notifyMsTeams = function notifyMSTeams (text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      '@context': 'https://schema.org/extensions',
      '@type': 'MessageCard',
      themeColor: '0072C6',
      title: `git-it-together report for ${moment().format('YYYY-MM-DD')}`,
      text,
      potentialAction: []
    })
    request.post(
      { form: postData, url: webhook },
      (err, response, body) => {
        if (err) {
          console.error(err)
          reject(err)
        } else {
          console.log('successfully posted to MS Teams')
          resolve(body)
        }
      })
  })
}
