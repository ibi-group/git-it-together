const Slackbot = require('slackbots')
const moment = require('moment')

const {
  buildMessage,
  getPullRequests,
  isBotMessage,
  isDesktopNotification,
  isDirectMessage
} = require('./helpers')

const env = process.env
const channels = env.SLACK_CHANNELS ? env.SLACK_CHANNELS.split(',') : []
const daysToRun =
  env.DAYS_TO_RUN || 'Monday,Tuesday,Wednesday,Thursday,Friday'
const timesToRun = env.TIMES_TO_RUN ? env.TIMES_TO_RUN.split(',') : [900]
const DEBUG = env.DEBUG || false
const groups = env.SLACK_GROUPS ? env.SLACK_GROUPS.split(',') : []
const checkInterval = 60000 // Run every minute (60000)
const botParams = env.SLACK_BOT_ICON ? { icon_url: env.SLACK_BOT_ICON } : {}

module.exports = function server () {
  const requiredEnvs = ['SLACK_TOKEN', 'GH_TOKEN', 'GH_REPOS']

  if (!requiredEnvs.every(k => !!env[k])) {
    throw new Error(
      'Missing one of this required ENV vars: ' + requiredEnvs.join(',')
    )
  }

  const bot = new Slackbot({
    token: env.SLACK_TOKEN,
    name: env.SLACK_BOT_NAME || 'Pr. Police'
  })

  bot.on('start', () => {
    setInterval(() => {
      const now = moment()
      // Check to see if current day and time are the correct time to run
      if (
        daysToRun.toLowerCase().indexOf(now.format('dddd').toLowerCase()) !== -1
      ) {
        for (var i = timesToRun.length; i--;) {
          if (parseInt(timesToRun[i]) === parseInt(now.format('kmm'))) {
            console.log(now.format('dddd YYYY-DD-MM h:mm a'))

            getPullRequests()
              .then(makeBuildMessage())
              .then(notifyAllChannels)
            return
          } else {
            if (i === 0) {
              DEBUG &&
                console.log(
                  now.format('kmm'),
                  'does not match any TIMES_TO_RUN (' + timesToRun + ')'
                )
            }
          }
        }
      } else {
        DEBUG &&
          console.log(
            now.format('dddd'),
            'is not listed in DAYS_TO_RUN (' + daysToRun + ')'
          )
      }
    }, checkInterval)
  })

  bot.on('message', data => {
    if (
      isDesktopNotification(data) ||
      (isDirectMessage(data) && !isBotMessage(data))
    ) {
      getPullRequests()
        .then(makeBuildMessage(data))
        .then(message => {
          bot.postMessage(data.channel, message, botParams)
        })
    }
  })

  bot.on('error', err => {
    console.error(err)
  })

  function makeBuildMessage (messageData) {
    return function (prs) {
      return buildMessage(prs, messageData)
    }
  }

  function notifyAllChannels (message) {
    channels.map(channel => {
      bot.postMessageToChannel(channel, message, botParams)
    })

    groups.map(group => {
      bot.postMessageToGroup(group, message, botParams)
    })
  }
}
