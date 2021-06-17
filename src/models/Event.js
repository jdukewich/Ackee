'use strict'

const events = require('../constants/events')
const dynamo = require('dynamodb')
const Joi = require('joi')

const Event = dynamo.define('Event', {
	hashKey: 'id',
	timestamps: true,
	createdAt: 'created',
	updatedAt: 'updated',

	schema: {
		id: dynamo.types.uuid(),
		title: Joi.string().required(),
		type: Joi.string().required(),
		created: Joi.date().required().default(Date.now),
		updated: Joi.date().required().default(Date.now)
	}
})

Event.find = async () => {
	const events = await Event.scan().exec().promise()
	return events[0].Items.map((item) => item.attrs)
}

Event.findOne = (id) => {
	return Event.get(id).then((model) => model === null ? model : model.attrs)
}

Event.findOneAndUpdate = (filter, doc) => {
	const updateObj = {
		...filter,
		...doc.$set
	}

	Event.update(updateObj, function(err, data) {
		if (err) {
			// Handle error?
		}
		return data
	})
}

Event.findOneAndDelete = (id) => {
	Event.destroy(id)
}

module.exports = Event