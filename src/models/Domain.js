'use strict'
const dynamo = require('dynamodb')
const Joi = require('joi')

const Domain = dynamo.define('Domain', {
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

Domain.find = async () => {
	return Domain.scan().exec().promise().then((res) => res[0].Items.map((item) => item.attrs))
}

Domain.findOne = (id) => {
	return Domain.get(id).then((model) => model === null ? model : model.attrs)
}

Domain.findOneAndUpdate = (filter, doc) => {
	const updateObj = {
		...filter,
		...doc.$set
	}

	Domain.update(updateObj, function(err, data) {
		if (err) {
			// Handle error?
		}
		return data
	})
}

Domain.findOneAndDelete = (id) => {
	Domain.destroy(id)
}

module.exports = Domain