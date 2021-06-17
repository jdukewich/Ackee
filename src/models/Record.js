'use strict'
const dynamo = require('dynamodb')
const Joi = require('joi')
const isUrl = require('is-url')

const isNullOrUrl = (value, helpers) => {
	if (value == null || isUrl(value)) {
		return value
	}
	return helpers.error('any.invalid')
}

const Record = dynamo.define('Record', {
	hashKey: 'id',
	timestamps: true,
	createdAt: 'created',
	updatedAt: 'updated',

	schema: {
		id: dynamo.types.uuid(),
		clientId: Joi.string(),
		domainId: Joi.string().required(),
		siteLocation: Joi.string().custom(isNullOrUrl),
		siteReferrer: Joi.string().custom(isNullOrUrl),
		siteLanguage: Joi.string().length(2),
		source: Joi.string(),
		screenWidth: Joi.number().min(0).max(100000),
		screenHeight: Joi.number().min(0).max(100000),
		screenColorDepth: Joi.number().min(1).max(48),
		deviceName: Joi.string(),
		deviceManufacturer: Joi.string(),
		osName: Joi.string(),
		osVersion: Joi.string(),
		browserName: Joi.string(),
		browserVersion: Joi.string(),
		browserWidth: Joi.number().min(0).max(100000),
		browserHeight: Joi.number().min(0).max(100000),
		created: Joi.date().required().default(Date.now),
		updated: Joi.date().required().default(Date.now)
	},

	indexes: [
		{ hashKey: 'created', name: 'CreatedIndex', type: 'global' },
		{ hashKey: 'updated', name: 'UpdatedIndex', type: 'global' },
		{ hashKey: 'clientId', name: 'ClientIdIndex', type: 'global' },
		{ hashKey: 'domainId', name: 'DomainIdIndex', type: 'global' }
	]
})

Record.aggregate = async (aggregation) => {
	// Might be slightly hard-coded, I'm not too familiar with MongoDB aggregations
	// $match, $group, $sort, $limit stages
	let records = await Record.scan().loadAll().exec().promise().then((resp) => {return resp[0].Items.map((item) => item.attrs)})
	let results = []
	const ids = []
	let groupByField
	// Stage 1: Matching
	const match = aggregation[0]['$match']
	if (match !== null) {
		for (const prop in match) {
			if (prop === '$or') {
				// Array like [ { source: { '$ne': null } }, { siteReferrer: { '$ne': null } } ]
				for (const item of match[prop]) {
					for (const field in item) { // Field will be like siteReferrer
						for (const expr in item[field]) {
							if (expr === '$ne') {
								records = records.filter((record) => record[field] && (item[field][expr] !== record[field]))
							}
						}
					}
				}
			}
			// Support for $in, $ne, $gte so far
			for (const filter in match[prop]) {
				if (filter === '$in') {
					records = records.filter((record) => match[prop][filter].indexOf(record[prop]) > -1)
				}

				if (filter === '$ne') {
					records = records.filter((record) => record[prop] && (match[prop][filter] !== record[prop]))
				}

				if (filter === '$gte') {
					// Hardcoded for Date?
					records = records.filter((record) => new Date(record[prop]) >= new Date(match[prop][filter]))
				}
			}
		}
	}
	// Stage 2: Grouping
	const group = aggregation[1]['$group']
	if (group !== null) {
		for (const field in group) {
			if (field === '_id') {
				for (const expr in group[field]) {
					// Group by this property
					groupByField = expr
					for (const record of records) {
						if (!(record[expr] in ids)) {
							ids[record[expr]] = results.length
							results.push({
								_id: { [expr]: record[expr] }
							})
						}
					}
				}
			} else if ('$sum' in group[field]) {
				for (const res of results) {
					res[field] = 0
				}
				for (const record of records) {
					results[ids[record[groupByField]]][field]++
				}
			}
		}
	}
	// Stage 3: Sorting
	if (aggregation.length > 2) {
		const sort = aggregation[2]['$sort']
		if (sort !== null) {
			for (const field in sort) {
				results.sort((a, b) => {
					return sort[field] * (a[field] - b[field])
				})
			}
		}
	}

	// Stage 4: Limiting
	if (aggregation.length > 3) {
		const limit = aggregation[3]['$limit']
		if (limit !== null) {
			if (results.length > limit) {
				results = results.slice(0, limit)
			}
		}
	}

	return results
}

Record.findOneAndUpdate = (filter, doc) => {
	const updateObj = {
		...filter,
		...doc.$set
	}

	Record.update(updateObj, function(err, data) {
		if (err) {
			// Handle error?
		}
		return data
	})
}

Record.updateMany = async (filter) => {
	let records = (await Record.scan().loadAll().exec().promise())[0].Items.map((record) => record.attrs)

	// Hardcode for $and query selector
	for (const selector in filter) {
		if (selector === '$and') {
			for (const sel of filter[selector]) {
				if ('id' in sel) {
					for (const expr in sel['id']) {
						if (expr === '$ne') {
							records = records.filter((record) => record['id'] !== sel['id'][expr])
						}
					}
				} else {
					for (const field in sel) {
						records = records.filter((record) => record[field] === sel[field])
					}
				}
			}
		}
	}

	records.forEach((record) => Record.update(record))
	// return records
}

Record.deleteMany = (domainId) => {
	// Retrieve all objects matching eventId
	const objs = Record
		.query(domainId)
		.usingIndex('DomainIdIndex')
		.exec()

	for (const obj of objs) {
		Record.destroy(obj)
	}
}

Record.create = async (createDict) => {
	// Use this wrapper to extract attrs field
	return Record.create(createDict).attrs
}

module.exports = Record