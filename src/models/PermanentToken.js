'use strict'
const dynamo = require('dynamodb')
const Joi = require('joi')

const PermanentToken = dynamo.define('PermanentToken', {
	hashKey: 'id',
	timestamps: true,
	createdAt: 'created',
	updatedAt: 'updated',

	schema: {
		id: dynamo.types.uuid(),
		title: Joi.string().required(),
		created: Joi.date().required().default(Date.now),
		updated: Joi.date().required().default(Date.now)
	}
})

PermanentToken.find = async () => {
	const tokens = await PermanentToken.scan().exec().promise()
	return tokens[0].Items.map((item) => item.attrs)
}

PermanentToken.findOne = (id) => {
	return PermanentToken.get(id).then((model) => model === null ? model : model.attrs)
}

PermanentToken.findOneAndUpdate = (filter, doc) => {
	const updateObj = {
		...filter,
		...doc.$set
	}

	PermanentToken.update(updateObj, function(err, data) {
		if (err) {
			// Handle err?
		}
		return data
	})
}

PermanentToken.findOneAndDelete = (id) => {
	PermanentToken.destroy(id)
}

module.exports = PermanentToken