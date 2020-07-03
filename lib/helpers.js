const Github = require('github-api')
const pullhub = require('pullhub')

const env = process.env
const blockedLabel = env.GH_BLOCKED_LABEL
const excludeLabels = env.GH_EXCLUDE_LABELS
  ? env.GH_EXCLUDE_LABELS.split(',')
  : []
const labels = env.GH_LABELS
const repos = env.GH_REPOS ? env.GH_REPOS.split(',') : []
const wipLabel = env.GH_WIP_LABEL

const gh = new Github({ token: process.env.GH_TOKEN })
if (!gh) {
  throw new Error('Invalid GH_TOKEN!')
}

/**
 * Parses an environment variable into a lookup. The environment variable must
 * have the format of key1:value1,key2:value2...
 */
function getOverrides (overridePattern) {
  const overrides = {}
  if (overridePattern) {
    overridePattern.split(',').forEach(override => {
      const [key, value] = override.split(':')
      overrides[key] = value
    })
  }
  return overrides
}

// create lookup of base branches
const baseBranches = getOverrides(process.env.BASE_BRANCH_OVERRIDES)
const compareBranchOverrides = getOverrides(process.env.COMPARE_BRANCH_OVERRIDES)

// ms-teams/slack formatting helpers
const formatForMsTeams = !!env.MS_TEAMS_WEBHOOK
const lineBreak = formatForMsTeams ? '<br/>' : '\n'
const slackEmojiLookup = {
  '⛓️': ':chains:',
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

function link (text, url) {
  return formatForMsTeams
    ? `[${text}](${url})`
    : `<${url}|${text}>`
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
 * @param  {Array<BranchAndComparison>} branches List of all branches and their
 *  comparison to the repo's master branch
 * @param  {Array<PR>} prs List of all PRs
 * @param  {String} [username] If included, the PRs will be filtered according
 *  to which PRs are assigned to a particular user
 * @return {Promise} Resolve type can be either a string or array of strings
 */
function buildMessage (branches, prs, username) {
  branches = branches.filter(branch => branch.comparison.ahead_by > 0)
  branches.sort((a, b) => {
    // first attempt to sort by repo
    if (a.repo < b.repo) return -1
    if (a.repo > b.repo) return 1

    // same repo, attempt to sort by branch name
    if (a.branch.name < b.branch.name) return -1
    if (a.branch.name > b.branch.name) return 1

    // same repo and branch? Not possible, but return 0 anyways.
    return 0
  })

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

  if (
    branches.length ||
      blocked.length ||
      needReview.length ||
      inProgress.length
  ) {
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

    if (branches.length > 0) {
      // since the branches message can be so long that MS Teams won't even show
      // the message, erase everything that was added from the PRs and create a
      // new message
      message = []

      message.push(
        `${getEmoji('⛓️')} ${bold(branches.length)} branch(es) are ahead of the base branch`
      )

      let curBranchRepo = null
      branches.forEach(branch => {
        if (branch.repo !== curBranchRepo) {
          message.push(bold(branch.repo))
          curBranchRepo = branch.repo
        }
        message.push(`‣ ${
          link(
            branch.branch.name,
            `https://github.com/${branch.repo}/tree/${branch.branch.name}`
          )
        }: ${branch.comparison.ahead_by} commit(s) ahead of ${branch.baseBranch}`)
      })
    }

    return Promise.resolve(message.join(lineBreak))
  } else {
    return Promise.resolve(username
      ? `${getEmoji('0️⃣')} No branches or pull requests need your attention! ${getEmoji('🎉')}`
      : `${getEmoji('0️⃣')} No branches or pull requests are waiting for review! ${getEmoji('🎉')}`
    )
  }
}

/**
 * Gets all active branches that are ahead of master
 */
async function getActiveBranches () {
  console.log('fetching branches')
  // get branches for each repo
  const branchesByRepo = await Promise.all(repos.map(getRepoBranches))
  const flattenedBranches = []
  branchesByRepo.forEach(repo => {
    repo.forEach(branch => flattenedBranches.push(branch))
  })
  console.log('done fetching branches')
  return flattenedBranches
}

/**
 * Makes API calls to github to obtain all branches ahead of master for a given
 * repo
 */
async function getRepoBranches (repo) {
  const [user, repoName] = repo.split('/')
  const ghRepo = gh.getRepo(user, repoName)
  const baseBranch = baseBranches[repo] || 'master'

  // Get the base branch first and store the base commit. It's possible that
  // there will be so many branches that the base branch won't be included in
  // the response of all branches.
  let baseCommit
  let baseBranchResult
  try {
    baseBranchResult = await ghRepo.getBranch(baseBranch)
    baseCommit = baseBranchResult.data.commit.sha
    if (compareBranchOverrides[repo]) {
      baseCommit = `${compareBranchOverrides[repo]}:${baseCommit}`
    }
  } catch (e) {
    console.error(`Couldn't find commit in ${baseBranch} in ${repo}`)
    console.log(baseBranchResult)
    throw e
  }

  // get all branches (may be limited to first )
  let branches = (await ghRepo.listBranches()).data

  // filter out dev and master branches
  branches = branches.filter(
    branch => branch.name !== baseBranch && branch.name !== 'dev'
  )

  // analyze all other branches to find any branches that are ahead of master
  return Promise.all(branches.map(async branch => {
    try {
      const comparison = (await ghRepo.compareBranches(
        baseCommit,
        branch.commit.sha
      )).data
      return { baseBranch, branch, comparison, repo }
    } catch (e) {
      console.error(`error occurred while analyzing ${repo}#${branch.name}`)
      return { baseBranch, branch, comparison: { ahead_by: 0 }, repo }
    }
  }))
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
    messages.push(bold(repo))
    prsByRepo[repo].sort()
    const prMessages = prsByRepo[repo].map(pr => {
      let assignees
      if (pr.assignees.length > 0) {
        assignees = bold(pr.assignees.map(assignee => assignee.login).join(', '))
      } else {
        assignees = getEmoji('🤷')
      }
      return `‣ ${pr.user.login} ☞ ${assignees} ${link(pr.number, pr.html_url)}: ${pr.title}`
    }).sort()
    messages.push(...prMessages)
  })
  return messages
}

module.exports = {
  buildMessage,
  getActiveBranches,
  getPullRequests
}
