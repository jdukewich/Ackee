'use strict'
const dynamo = require('dynamodb')
const Joi = require('joi')

const Token = dynamo.define('Token', {
	hashKey: 'id',
	timestamps: true,
	createdAt: 'created',
	updatedAt: 'updated',

	schema: {
		id: dynamo.types.uuid(),
		created: Joi.date().required().default(Date.now),
		updated: Joi.date().required().default(Date.now)
	}
})

Token.findOne = (id) => {
	return Token.get(id).then((model) => model === null ? model : model.attrs)
}

Token.findOneAndUpdate = (filter, doc) => {
	const updateObj = {
		...filter,
		...doc.$set
	}

	Token.update(updateObj, function(err, data) {
		if (err) {
			// Handle err?
		}
		return data
	})
}

Token.findOneAndDelete = (id) => {
	return Token.destroy(id)
}

Token.create = async (createDict) => {
	// Use this wrapper to extract attrs field
	return Token.create(createDict).attrs
}

module.exports = Token