# Pr. Police [![Build Status](https://travis-ci.org/Talkdesk/pr-police.svg?branch=master)](https://travis-ci.org/Talkdesk/pr-police)

![Pr. Police logo](https://raw.githubusercontent.com/Talkdesk/pr-police/master/images/logo-blue-small.png)

## About

Pr. Police is a slackbot that sends to configured slack channels a listing of open pull requests that are waiting for a review. It supports watching multiple repositories, and filtering the pull requests by label.

This project was built as part of the Talkdesk Hackathon April 2017, but this fork is heavily modified to fit the needs of Conveyal's software development process.

This bot is able to respond with a help message, PRs assigned to yourself or a list of all open PRs.  If you @PR Police with `help` it'll send you a help message.  If you @PR Police and include the word `me`, then the bot will respond with a filtered list of PRs assigned to you, otherwise it'll report on all PRs.  Your slack username and github username need to have at least the first 3 characters matching (case insensitive).  For example if your github username is `blahblah` but your slack username is `Blah-B` it'll match.

## Deploying the bot

### The quick and easy way

The easiest way to get an instance of Pr. Police up and running is to deploy it to Heroku by clicking on the button below.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

You'll still need to fill in all the environment variables. For more info on this, head down to the Configuration section.

## Running the bot locally

### Install

Git clone this repository then:

    npm install

#### Run

    SLACK_TOKEN=secret GH_TOKEN=secret GH_REPOS=johndoe/somerepo,johndoe/anotherrepo npm start

This will start the server locally until `Ctrl-C` is pressed.  You'll then be able to communicate with the bot on a channel the bot has been invited to.

**Note:** You will need to pass all the required env vars.

#### Test run via local command line

    SLACK_TOKEN=secret GH_TOKEN=secret GH_REPOS=johndoe/somerepo,johndoe/anotherrepo ./bin/pr-police --cli

## Configuration

Pr. Police has the following environment variables available:

##### `DEBUG`

Debug flag used to enable more verbose logging. Default: `false`

##### `DAYS_TO_RUN`

Which days of the week to run on. Default: `Monday,Tuesday,Wednesday,Thursday,Friday`

##### `GH_TOKEN`

The github account token to access the repos

##### `SLACK_TOKEN`

The slack token for the bot to access your slack team

##### `GH_REPOS`

The list of repositories to watch. The format is `user/repo` and comma separated.

Example: `rogeriopvl/gulp-ejs,rogeriopvl/pullhub,talkdesk/pr-police`

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

The list of channels on your team where Pr. Police will post the announcements. Multiple channels are comma separated.

##### `SLACK_GROUPS`

The list of private groups on your team where Pr. Police will post the announcements. Multiple channels are comma separated.

##### `SLACK_BOT_DISPLAY_NAME`

The display name of your Pr. Police bot on slack.  Default: `Pr. Police`.

##### `SLACK_BOT_ICON`

URL of the icon for the slack bot when sending messages.

##### `SLACK_BOT_USER_NAME`

The username of your Pr. Police bot on slack.  The username of the bot as defined in Slack must match this environment variable in order for the bot to work!  Default: `pr-police`.

##### `TIMES_TO_RUN`

What times of day to run (24-hour format, leading zeroes are not necessary). Multiple times are comma-separated. Default: `0900`.

##### `TZ`

The timezone the server should use. Heroku default is UTC. Uses tz database timezone format. Example: `America/Los_Angeles`.

## Heroku configuration

If heroku attempts to start a web process instead of a worker, you may need to run: `heroku ps:scale web=0 worker=1 -a {HEROKU_APP_NAME}`

## Credits

Pr. Police was developed by [Rogério Vicente](https://github.com/rogeriopvl) during one of Talkdesk's internal hackathons.

Artwork created by [Micaela Neto](https://cargocollective.com/micaelaneto)
