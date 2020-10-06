const {
  buildMessage,
  getActiveBranches,
  getPullRequests
} = require('./helpers')
const { notifyMsTeams } = require('./ms-teams')

module.exports.run = async event => {
  const branches = await getActiveBranches()
  const pullRequests = await getPullRequests()
  const prMessage = await buildMessage([], pullRequests)
  await notifyMsTeams('open PR', prMessage)
  const branchesMessage = await buildMessage(branches, [])
  await notifyMsTeams('deviating branches', branchesMessage)
}
