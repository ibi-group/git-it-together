const Slackbot = require('slackbots')
const moment = require('moment')

const {
  buildMessage,
  getPullRequests,
  isBotMessage,
  isDirectMessage,
  isMessage
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
const slackBotDisplayName = env.SLACK_BOT_DISPLAY_NAME || 'Pr. Police'
const slackBotUserName = env.SLACK_BOT_USER_NAME || 'pr-police'
let botId

module.exports = function server () {
  const requiredEnvs = ['SLACK_TOKEN', 'GH_TOKEN', 'GH_REPOS']

  if (!requiredEnvs.every(k => !!env[k])) {
    throw new Error(
      'Missing one of this required ENV vars: ' + requiredEnvs.join(',')
    )
  }

  let bot = connectToSlack()

  // we don't yet know the bot's Id, so we must make a request on initialization
  // to figure that out
  bot.on('start', () => {
    bot.getUserId(slackBotUserName)
      .then(data => { botId = data })
      .catch(err => {
        console.error(err)
        throw new Error('Could not find bot Id!')
      })

    // set an interval to automatically report PR status at a given time on
    // certain days
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
      (isMessage(data) && isNotifyingBot(data)) ||
      (isDirectMessage(data) && !isBotMessage(data))
    ) {
      if (data.text.toLowerCase().match(/\bhelp\b/)) {
        const helpMessage = "Type a message with `me` to see PRs assigned just to you.  Type `help` to see this message.  If neither of those keywords are included, I'll just return a list of all PRs."
        if (isDirectMessage(data)) {
          bot.postMessage(data.channel, helpMessage, botParams)
        } else {
          bot.postEphemeral(data.channel, data.user, helpMessage, botParams)
        }
      } else if (data.text.toLowerCase().match(/\bme\b/)) {
        bot.getUsers()
          .then(userData => {
            const username = userData.members.find(
              member => member.id === data.user
            ).name
            getPullRequests()
              .then(makeBuildMessage(username))
              .then(message => {
                bot.postMessage(data.channel, message, botParams)
              })
          })
      } else {
        getPullRequests()
          .then(makeBuildMessage())
          .then(message => {
            bot.postMessage(data.channel, message, botParams)
          })
      }
    }
  })

  bot.on('error', err => {
    console.error(err)
  })

  bot.on('close', () => {
    bot = connectToSlack()
  })

  function connectToSlack () {
    return new Slackbot({
      token: env.SLACK_TOKEN,
      name: slackBotDisplayName
    })
  }

  function isNotifyingBot (msg) {
    return msg.text && msg.text.startsWith(`<@${botId}>`)
  }

  function makeBuildMessage (username) {
    return function (prs) {
      return buildMessage(prs, username)
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
