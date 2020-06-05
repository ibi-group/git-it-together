# git-it-together

## About

git-it-together is a cli tool/serverless process that sends to configured slack channels a listing of open pull requests that are waiting for a review. It supports watching multiple repositories, and filtering the pull requests by label.

This project was built as part of the Talkdesk Hackathon April 2017, but this fork is heavily modified to fit the needs of IBI Groups's software development process.

## Deploying as a serverless application

```shell
yarn global add serverless
serverless deploy
```

## Running the bot locally

### Install

Git clone this repository then:

```shell
npm install
```

And then copy `serverless-example.yml` to `serverless.yml` and update values as needed.

#### Test run via local command line

```shell
SLACK_TOKEN=secret GH_TOKEN=secret GH_REPOS=johndoe/somerepo,johndoe/anotherrepo ./bin/git-it-together --cli
```

#### Test posting to MS-TEAMS using serverless run via local command line

```shell
MS_TEAMS_WEBHOOK=https://outlook.office.com/webhook/change_me GH_REPOS=ibi-group/trimet-mod-otp ./bin/git-it-together --cli
```

or

```shell
serverless invoke local --function git-it-together
```

## Configuration

git-it-together has the following environment variables available:

##### `DEBUG`

Debug flag used to enable more verbose logging. Default: `false`

##### `DAYS_TO_RUN`

Which days of the week to run on. Default: `Monday,Tuesday,Wednesday,Thursday,Friday`

##### `GH_TOKEN`

The github account token to access the repos. (only required if using private repos)

##### `SLACK_TOKEN`

The slack token for the bot to access your slack team

##### `GH_REPOS`

The list of repositories to watch. The format is `user/repo` and comma separated.

Example: `rogeriopvl/gulp-ejs,rogeriopvl/pullhub`

##### `GH_EXCLUDE_LABELS`

PR labels, comma-separated, to be hidden from Slack. Will override `GH_LABELS`. Use in case you don’t want to announce blocked or in-progress work via `GH_BLOCKED_LABEL` or `GH_WIP_LABEL`.

Example: `test,in-progress`

##### `GH_LABELS`

PR labels, comma-separated, to announce in Slack. If omitted, all labels (besides `GH_EXCLUDE_LABELS`) will be announced.

Example: `ready,needs-review`

##### `GH_BLOCKED_LABEL`

Label to mark PRs that are blocked and need assistance. `GH_EXCLUDE_LABELS` will override this.

Example: `blocked`

##### `GH_WIP_LABEL`

Label to mark PRs that are works in progress (WIP) and not ready for review yet. `GH_EXCLUDE_LABELS` will override this.

Example: `wip`

##### `SLACK_CHANNELS`

The list of channels on your team where git-it-together will post the announcements. Multiple channels are comma separated.

##### `SLACK_GROUPS`

The list of private groups on your team where git-it-together will post the announcements. Multiple channels are comma separated.

##### `SLACK_BOT_DISPLAY_NAME`

The display name of your git-it-together bot on slack.  Default: `git-it-together`.

##### `SLACK_BOT_ICON`

URL of the icon for the slack bot when sending messages.

##### `SLACK_BOT_USER_NAME`

The username of your git-it-together bot on slack.  The username of the bot as defined in Slack must match this environment variable in order for the bot to work!  Default: `git-it-together`.

##### `TIMES_TO_RUN`

What times of day to run (24-hour format, leading zeroes are not necessary). Multiple times are comma-separated. Default: `0900`.

##### `TZ`

The timezone the server should use. Heroku default is UTC. Uses tz database timezone format. Example: `America/Los_Angeles`.

##### `MS_TEAMS_WEBHOOK`

The webhook to send messages to MS Teams to. *NOTE: if this is set, messages will be formatted specifically for MS Teams*

## Heroku configuration

If heroku attempts to start a web process instead of a worker, you may need to run: `heroku ps:scale web=0 worker=1 -a {HEROKU_APP_NAME}`

## Credits

The original version of git-it-together was developed by [Rogério Vicente](https://github.com/rogeriopvl) during one of Talkdesk's internal hackathons.

Artwork created by [Micaela Neto](https://cargocollective.com/micaelaneto)
