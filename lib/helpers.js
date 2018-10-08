const pullhub = require('pullhub')

const commands = require('./commands')
const messages = require('./messages')

const env = process.env
const blockedLabel = env.GH_BLOCKED_LABEL
const excludeLabels = env.GH_EXCLUDE_LABELS
  ? env.GH_EXCLUDE_LABELS.split(',')
  : []
const labels = env.GH_LABELS
const repos = env.GH_REPOS ? env.GH_REPOS.split(',') : []
const wipLabel = env.GH_WIP_LABEL

function buildMessage (data) {
  if (!data) return Promise.resolve(messages.GITHUB_ERROR)

  const hasLabel = (PR, label) =>
    PR.labels.some(({ name }) => name === label)

  const blocked = []
  const needReview = []
  const inProgress = []

  const whitelisted = data.filter(
    ({ labels }) =>
      !labels.some(({ name }) => excludeLabels.indexOf(name) >= 0)
  )

  whitelisted.forEach(PR => {
    console.log(PR)
    if (hasLabel(PR, blockedLabel)) return blocked.push(PR)
    if (hasLabel(PR, wipLabel)) return inProgress.push(PR)
    return needReview.push(PR)
  })

  if (blocked.length || needReview.length || inProgress.length) {
    let message = []

    if (blocked.length)
      message = [
        ...message,
        messages.PR_LIST_BLOCKED.replace(/\${NUMBER}/, blocked.length),
        ...orderPRsByRepo(blocked)
      ]

    if (needReview.length)
      message = [
        ...message,
        messages.PR_LIST_REVIEW.replace(/\${NUMBER}/, needReview.length),
        ...orderPRsByRepo(needReview)
      ]

    if (inProgress.length)
      message = [
        ...message,
        messages.PR_LIST_WIP.replace(/\${NUMBER}/, inProgress.length),
        ...orderPRsByRepo(inProgress)
      ]

    return Promise.resolve(message.join('\n'))
  }
}

// for now all commands execute the same operation
function isBotCommand (msg) {
  return commands.some((command) => msg.text === command)
}

function isBotMessage (msg) {
  return msg.subtype && msg.subtype === 'bot_message'
}

function isDirectMessage (msg) {
  // slack direct messages channel id start with D
  return msg.type === 'message' && msg.channel.charAt(0) === 'D'
}

function isMessage (msg) {
  return msg.type === 'message'
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
    const prMessages = prsByRepo[repo].map(pr =>
      `‣ [${pr.user.login}] <${pr.html_url}|${pr.number}>: ${pr.title}`
    ).sort()
    messages.push(...prMessages)
  })
  return messages
}

module.exports = {
  buildMessage,
  getPullRequests,
  isBotCommand,
  isBotMessage,
  isDirectMessage,
  isMessage
}
