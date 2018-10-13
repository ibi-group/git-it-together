const pullhub = require('pullhub')

const env = process.env
const blockedLabel = env.GH_BLOCKED_LABEL
const excludeLabels = env.GH_EXCLUDE_LABELS
  ? env.GH_EXCLUDE_LABELS.split(',')
  : []
const labels = env.GH_LABELS
const repos = env.GH_REPOS ? env.GH_REPOS.split(',') : []
const wipLabel = env.GH_WIP_LABEL

function assigneeFilter (pr, messageData) {
  for (
    let userish = messageData.content.split(':')[0].replace(' ', '').toLowerCase();
    userish.length > 3;
    userish = userish.substr(0, userish.length - 1)
  ) {
    if (
      pr.assignee &&
      pr.assignee.login &&
      pr.assignee.login.toLowerCase().startsWith(userish)
    ) return true
  }
  return false
}

/**
 * Build a message to send back to slack
 * @param  {Array<PR>} prs List of all PRs
 * @param  {SlackMessage} [messageData] If included, the PRs will potentially be
 * filtered if it seems like a user wants to know prs needing their attention
 * @return {Promise} Resolve type can be either a string or array of strings
 */
function buildMessage (prs, messageData) {
  if (!prs) return Promise.resolve(':rotating_light: Could not fetch pull requests.')

  const hasLabel = (PR, label) =>
    PR.labels.some(({ name }) => name === label)

  const askingForOwnAssignedPrs = messageData &&
    messageData.content &&
    messageData.content.split('@PR Police')[1].indexOf('me') > -1

  const blocked = []
  const needReview = []
  const inProgress = []

  const whitelisted = prs.filter(
    pr =>
      !pr.labels.some(({ name }) => excludeLabels.indexOf(name) >= 0) &&
      askingForOwnAssignedPrs ? assigneeFilter(pr, messageData) : true
  )

  whitelisted.forEach(PR => {
    if (hasLabel(PR, blockedLabel)) return blocked.push(PR)
    if (hasLabel(PR, wipLabel)) return inProgress.push(PR)
    return needReview.push(PR)
  })

  if (blocked.length || needReview.length || inProgress.length) {
    const total = blocked.length + needReview.length + inProgress.length
    let message = askingForOwnAssignedPrs ? [`*${total} issue(s) need your attention*`] : []

    if (blocked.length) {
      message = [
        ...message,
        '\n',
        `:warning: *${blocked.length}* PRs are *blocked*`,
        ...orderPRsByRepo(blocked)
      ]
    }

    if (needReview.length) {
      message = [
        ...message,
        '\n',
        `:eyes: *${needReview.length}* PRs need a review:`,
        ...orderPRsByRepo(needReview)
      ]
    }

    if (inProgress.length) {
      message = [
        ...message,
        '\n',
        `:construction_worker: *${inProgress.length}* PRs are in-progress:`,
        ...orderPRsByRepo(inProgress)
      ]
    }

    if (!askingForOwnAssignedPrs) {
      // tally up and rank who has the most items assigned to themselves
      message = [
        ...message,
        '\n',
        '*Pull requests assigned per user:*'
      ]
      const assigneePrCount = {}
      whitelisted.forEach(pr => {
        if (!pr.assignee || !pr.assignee.login) return
        assigneePrCount[pr.assignee.login] = (assigneePrCount[pr.assignee.login] || 0) + 1
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

    return Promise.resolve(message.join('\n'))
  } else {
    return Promise.resolve(askingForOwnAssignedPrs
      ? ':cop: No pull requests need your attention! :tada:'
      : ':cop: No pull requests are waiting for review! :tada:'
    )
  }
}

function isBotMessage (msg) {
  return msg.subtype && msg.subtype === 'bot_message'
}

function isDesktopNotification (msg) {
  return msg.type === 'desktop_notification'
}

function isDirectMessage (msg) {
  // slack direct messages channel id start with D
  return msg.type === 'message' && msg.channel.charAt(0) === 'D'
}

function getPullRequests () {
  console.log('Checking for pull requests…')

  return pullhub(repos, labels).catch(err => {
    console.error(err)
  })
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
    messages.push(`*${repo}*`)
    prsByRepo[repo].sort()
    const prMessages = prsByRepo[repo].map(pr => {
      const assigneeCount = pr.assignees.length
      let assignee = ':shrug:'
      if (assigneeCount > 0) assignee = `*${pr.assignee.login}*`
      if (assigneeCount > 1) assignee += ` +${assigneeCount - 1}`
      const link = `<${pr.html_url}|${pr.number}>`
      return `‣ ${pr.user.login} ☞ ${assignee} ${link}: ${pr.title}`
    }).sort()
    messages.push(...prMessages)
  })
  return messages
}

module.exports = {
  buildMessage,
  getPullRequests,
  isBotMessage,
  isDesktopNotification,
  isDirectMessage
}
