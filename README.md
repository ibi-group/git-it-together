# git-it-together

## About

git-it-together is a serverless process that creates a report of open pull requests that are waiting for a review. It supports watching multiple repositories, and filtering the pull requests by label. Although it has some remnants of code that could work as a slackbot, this fork only supports running a servless process that sends a message to a MS Teams webhook.

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


#### Test posting to MS Teams using serverless run via local command line

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

##### `GH_TOKEN`

The github account token to access the repos. (only required if using private repos)

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

##### `MS_TEAMS_WEBHOOK`

The webhook to send messages to MS Teams to. *NOTE: if this is set, messages will be formatted specifically for MS Teams*

## Credits

The original version of git-it-together was developed by [Rogério Vicente](https://github.com/rogeriopvl) during one of Talkdesk's internal hackathons.

Artwork created by [Micaela Neto](https://cargocollective.com/micaelaneto)
