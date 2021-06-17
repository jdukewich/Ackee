'use strict'
const dynamo = require('dynamodb')
const Joi = require('joi')

const Action = dynamo.define('Action', {
	hashKey: 'id',
	timestamps: true,
	createdAt: 'created',
	updatedAt: 'updated',

	schema: {
		id: dynamo.types.uuid(),
		eventId: Joi.string().required(),
		key: Joi.string(),
		value: Joi.number().required(),
		details: Joi.string(),
		created: Joi.date().required().default(Date.now),
		updated: Joi.date().required().default(Date.now)
	},

	indexes: [
		{ hashKey: 'eventId', name: 'EventIdIndex', type: 'global' },
		{ hashKey: 'created', name: 'CreatedIndex', type: 'global' },
		{ hashKey: 'updated', name: 'UpdatedIndex', type: 'global' }
	]
})

Action.aggregate = async (aggregation) => {
	console.log('Calling Action aggregate')
	console.log(JSON.stringify(aggregation))
	return []
}

Action.findOneAndUpdate = (filter, doc) => {
	const updateObj = {
		...filter,
		...doc.$set
	}
	Action.update(updateObj, function(err, data) {
		if (err) {
			// Handle error??
		}
		return data
	})
}

Action.deleteMany = (eventId) => {
	// Retrieve all objects matching eventId
	const objs = Action
		.query(eventId)
		.usingIndex('EventIdIndex')
		.exec()
	for (const obj of objs) {
		Action.destroy(obj)
	}
}

module.exports = Action