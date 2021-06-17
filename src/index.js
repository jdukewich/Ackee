#!/usr/bin/env node
'use strict'
require('dotenv').config()

const server = require('./server')
const signale = require('./utils/signale')
const config = require('./utils/config')


server.on('listening', () => signale.watch(`Listening on http://localhost:${ config.port }`))
server.on('error', (err) => signale.fatal(err))

signale.start(`Starting the server`)

server.listen(config.port)

if (config.isDevelopmentMode === true) {
	signale.info('Development mode enabled')
}

if (config.isDemoMode === true) {
	signale.info('Demo mode enabled')
}