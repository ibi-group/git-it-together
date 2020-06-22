const { buildMessage, getPullRequests } = require('./helpers')
const { notifyMsTeams } = require('./ms-teams')

module.exports.run = async event => {
  const prs = await getPullRequests()
  const message = await buildMessage(prs)
  await notifyMsTeams(message)
}
