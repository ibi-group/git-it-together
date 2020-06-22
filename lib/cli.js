const { buildMessage, getPullRequests } = require('./helpers')
const serverless = require('./serverless')
const server = require('./slackbot-server')
const meta = require('../package.json')

module.exports = function (args) {
  if (args.help) {
    showUsage()
    process.exit(0)
  } else if (args.version) {
    showVersion()
    process.exit(0)
  } else if (args.cli) {
    runAndPrintToConsole()
  } else if (args.serverless) {
    serverless.run()
  } else if (args._.length > 0) {
    showUsage()
    process.exit(-1)
  } else {
    server()
  }
}

function showUsage () {
  console.log(meta.name + ' [--version] [--help]\n')
  console.log('\t--version  show version info')
  console.log('\t--help     show this usage info')
}

function showVersion () {
  console.log(meta.name + ' version ' + meta.version)
}

function runAndPrintToConsole () {
  getPullRequests()
    .then(buildMessage)
    .then(console.log)
}
