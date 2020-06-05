const pullhub = require('pullhub')

const env = process.env
const blockedLabel = env.GH_BLOCKED_LABEL
const excludeLabels = env.GH_EXCLUDE_LABELS
  ? env.GH_EXCLUDE_LABELS.split(',')
  : []
const labels = env.GH_LABELS
const repos = env.GH_REPOS ? env.GH_REPOS.split(',') : []
const wipLabel = env.GH_WIP_LABEL

const formatForMsTeams = !!env.MS_TEAMS_WEBHOOK
const lineBreak = formatForMsTeams ? '<br/>' : '\n'
const slackEmojiLookup = {
  '👷': ':construction_worker:',
  '👀': ':eyes:',
  '🚨': ':rotating_light:',
  '🤷': ':shrug:',
  '🎉': ':tada:',
  '⚠️': ':warning:',
  '0️⃣': ':zero:'
}

function getEmoji (key) {
  if (!formatForMsTeams) {
    return slackEmojiLookup[key]
  }
  return key
}

function bold (text) {
  return formatForMsTeams
    ? `<b>${text}</b>`
    : `*${text}*`
}

/**
 * Helper function to identify PRs that are assigned to a particular user.
 * There might be a mismatch between slack username and github username, so this
 * function will keep trying to see if part of the start of the slack username
 * matches the start of github username until the username is less than 2
 * characters long.
 */
function assigneeFilter (pr, username) {
  username = username.toLowerCase()
  for (
    ; username.length > 3; username = username.substr(0, username.length - 1)
  ) {
    if (
      pr.assignee &&
      pr.assignee.login &&
      pr.assignee.login.toLowerCase().startsWith(username)
    ) return true
  }
  return false
}

/**
 * Build a message to send back to slack
 * @param  {Array<PR>} prs List of all PRs
 * @param  {SlackMessage} [username] If included, the PRs will be
 * filtered according to which PRs are assigned to a particular user
 * @return {Promise} Resolve type can be either a string or array of strings
 */
function buildMessage (prs, username) {
  if (!prs) {
    return Promise.resolve(`${getEmoji('🚨')} Could not fetch pull requests.`)
  }

  const hasLabel = (PR, label) =>
    PR.labels.some(({ name }) => name === label)

  const blocked = []
  const needReview = []
  const inProgress = []

  // get the whitelisted PRs.  PRs that could be filtered out are those that
  // have a label that should be excluded or if those not assigned to the
  // specified user if a username is provided to filter for
  const whitelisted = prs.filter(
    pr =>
      !pr.labels.some(({ name }) => excludeLabels.indexOf(name) >= 0) &&
        username ? assigneeFilter(pr, username) : true
  )

  whitelisted.forEach(PR => {
    if (hasLabel(PR, blockedLabel)) return blocked.push(PR)
    if (hasLabel(PR, wipLabel)) return inProgress.push(PR)
    return needReview.push(PR)
  })

  if (blocked.length || needReview.length || inProgress.length) {
    const total = blocked.length + needReview.length + inProgress.length
    let message = username ? [bold(`${total} PR(s) need your attention`)] : []

    if (blocked.length) {
      if (message.length > 0) {
        message.push(lineBreak)
      }
      message = [
        ...message,
        `${getEmoji('⚠️')} ${bold(blocked.length)} PRs are ${bold('blocked')}`,
        ...orderPRsByRepo(blocked)
      ]
    }

    if (needReview.length) {
      if (message.length > 0) {
        message.push(lineBreak)
      }
      message = [
        ...message,
        `${getEmoji('👀')} ${bold(needReview.length)} PRs need a review:`,
        ...orderPRsByRepo(needReview)
      ]
    }

    if (inProgress.length) {
      if (message.length > 0) {
        message.push(lineBreak)
      }
      message = [
        ...message,
        `${getEmoji('👷')} ${bold(inProgress.length)} PRs are in-progress:`,
        ...orderPRsByRepo(inProgress)
      ]
    }

    if (!username) {
      // tally up and rank who has the most items assigned to themselves
      if (message.length > 0) {
        message.push(lineBreak)
      }
      message = [
        ...message,
        bold('PRs assigned per user:')
      ]
      const assigneePrCount = {}
      whitelisted.forEach(pr => {
        pr.assignees.forEach(assignee => {
          assigneePrCount[assignee.login] = (assigneePrCount[assignee.login] || 0) + 1
        })
        if (pr.assignees.length === 0) {
          const assigneeUser = `${getEmoji('🤷')} (unassigned)`
          assigneePrCount[assigneeUser] = (assigneePrCount[assigneeUser] || 0) + 1
        }
      })

      const assigneePrs = Object.keys(assigneePrCount).map(assignee => ({
        assignee,
        count: assigneePrCount[assignee]
      })).sort((a, b) => b.count - a.count)

      message = [
        ...message,
        ...assigneePrs.map(ap => `${ap.assignee}: ${ap.count}`)
      ]
    }

    return Promise.resolve(message.join(lineBreak))
  } else {
    return Promise.resolve(username
      ? `${getEmoji('0️⃣')} No pull requests need your attention! ${getEmoji('🎉')}`
      : `${getEmoji('0️⃣')} No pull requests are waiting for review! ${getEmoji('🎉')}`
    )
  }
}

function getPullRequests () {
  console.log('Checking for pull requests…')

  return pullhub(repos, labels).catch(err => {
    console.error(err)
  })
}

function isBotMessage (msg) {
  return msg.subtype && msg.subtype === 'bot_message'
}

function isDirectMessage (msg) {
  // slack direct messages channel id start with D
  return isMessage(msg) && msg.channel.charAt(0) === 'D'
}

function isMessage (msg) {
  return msg.type === 'message'
}

function orderPRsByRepo (prs) {
  const messages = []
  const prsByRepo = {}
  prs.forEach(pr => {
    const repo = pr.repository_url.replace('https://api.github.com/repos/', '')
    prsByRepo[repo] = prsByRepo[repo] || []
    prsByRepo[repo].push(pr)
  })
  const repos = Object.keys(prsByRepo).sort()
  repos.forEach(repo => {
    messages.push(bold(repo))
    prsByRepo[repo].sort()
    const prMessages = prsByRepo[repo].map(pr => {
      let assignees
      if (pr.assignees.length > 0) {
        assignees = bold(pr.assignees.map(assignee => assignee.login).join(', '))
      } else {
        assignees = getEmoji('🤷')
      }
      const link = formatForMsTeams
        ? `[${pr.number}](${pr.html_url})`
        : `<${pr.html_url}|${pr.number}>`
      return `‣ ${pr.user.login} ☞ ${assignees} ${link}: ${pr.title}`
    }).sort()
    messages.push(...prMessages)
  })
  return messages
}

module.exports = {
  buildMessage,
  getPullRequests,
  isBotMessage,
  isDirectMessage,
  isMessage
}
