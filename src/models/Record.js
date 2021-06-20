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
	// console.log(JSON.stringify(aggregation))
	let results = await Record.scan().loadAll().exec().promise().then((resp) => {return resp[0].Items.map((item) => item.attrs)})
	for (const task of aggregation) {
		if ('$match' in task) {
			// A match contains a dictionary of properties to match on or an OR expression
			const match = task['$match']
			for (const property in match) {
				if (property === '$or') {
					// Array like [ { source: { '$ne': null } }, { siteReferrer: { '$ne': null } } ]
					for (const item of match[property]) {
						for (const field in item) { // Field will be like siteReferrer
							for (const expr in item[field]) {
								if (expr === '$ne') {
									results = results.filter((record) => record[field] && (item[field][expr] !== record[field]))
								} else {
									// No support for this expression yet!
									console.error(`ERROR: No support for ${ expr } expression within $or matching`)
								}
							}
						}
					}
				} else {
					// Not the $or property, must be a field name
					// Can have multiple matching expressions like $gte, $ne, $in
					for (const expr in match[property]) {
						if (expr === '$in') {
							results = results.filter((record) => match[property][expr].indexOf(record[property]) > -1)
						} else if (expr === '$exists') {
							results = results.filter((record) => record[property])
						} else if (expr === '$ne') {
							results = results.filter((record) => record[property] && (match[property][expr] !== record[property]))
						} else if (expr === '$gte') {
							results = results.filter((record) => new Date(record[property]) >= new Date(match[property][expr]))
						} else if (expr === '$lt') {
							results = results.filter((record) => new Date(record[property]) < new Date(match[property][expr]))
						} else {
							// No support for this expression yet!
							console.error(`ERROR: No support for ${ expr } expression within field matching`)
						}
					}
				}
			}
		} else if ('$group' in task) {
			const group = task['$group']
			const newResults = []
			for (const expr in group) {
				const fields = Object.keys(group['_id']) // All the group by fields
				if (expr === '_id') {
					for (const record of results) {
						const day = (new Date(record['created'])).getDate()
						const month = (new Date(record['created'])).getMonth() + 1
						const year = (new Date(record['created'])).getFullYear()
						// Check if another record with these values was already found
						if (newResults.filter((item) => {
							for (const field of fields) {
								if (field === 'day') {
									if (item['_id'][field] !== day) {
										return false
									}
								} else if (field === 'month') {
									if (item['_id'][field] !== month) {
										return false
									}
								} else if (field === 'year') {
									if (item['_id'][field] !== year) {
										return false
									}
								} else if (item['_id'][field] !== record[field]) {
									return false
								}
							}
							return true
						}).length === 0) {
							newResults.push({
								_id: {}
							})
							for (const field of fields) {
								if (field === 'day') {
									newResults[newResults.length - 1]['_id']['day'] = day
								} else if (field === 'month') {
									newResults[newResults.length - 1]['_id']['month'] = month
								} else if (field === 'year') {
									newResults[newResults.length - 1]['_id']['year'] = year
								} else {
									newResults[newResults.length - 1]['_id'][field] = record[field]
								}
							}
						}
					}
				} else if (expr === 'count') {
					for (const countField in group[expr]) {
						if (countField === '$sum') {
							for (const record of results) {
								const day = (new Date(record['created'])).getDate()
								const month = (new Date(record['created'])).getMonth() + 1
								const year = (new Date(record['created'])).getFullYear()
								// Find result with fields matching this record and increment count
								const res = newResults.findIndex((element) => {
									for (const field of fields) {
										if (field === 'day') {
											if (element['_id'][field] !== day) {
												return false
											}
										} else if (field === 'month') {
											if (element['_id'][field] !== month) {
												return false
											}
										} else if (field === 'year') {
											if (element['_id'][field] !== year) {
												return false
											}
										} else if (element['_id'][field] !== record[field]) {
											return false
										}
									}
									return true
								})
								if ('count' in newResults[res]) {
									newResults[res]['count']++
								} else {
									newResults[res]['count'] = 1
								}
							}
						} else if (countField === '$avg') {
							for (const result of newResults) {
								const matchRecords = results.filter((element) => {
									const day = (new Date(element['created'])).getDate()
									const month = (new Date(element['created'])).getMonth() + 1
									const year = (new Date(element['created'])).getFullYear()
									for (const field of fields) {
										if (field === 'day') {
											if (result['_id'][field] !== day) {
												return false
											}
										} else if (field === 'month') {
											if (result['_id'][field] !== month) {
												return false
											}
										} else if (field === 'year') {
											if (result['_id'][field] !== year) {
												return false
											}
										} else if (result['_id'][field] !== element[field]) {
											return false
										}
									}
									return true
								})

								// Get the average duration, no support for other fields yet
								let avg = matchRecords.reduce((accum, current) => accum + current['duration'], 0)
								avg = avg / matchRecords.length
								result['count'] = avg
							}
						} else {
							console.error(`ERROR: No support for ${ countField } expression within $group -> count`)
						}
					}
				} else {
					// No support for this expression yet!
					console.error(`ERROR: No support for ${ expr } expression within $group`)
				}
			}
			results = newResults
		} else if ('$project' in task) {
			const project = task['$project']
			for (const record of results) {
				for (const field in project) {
					if (field === 'duration') {
						for (const step in project[field]) {
							if (step === '$subtract') {
								record['duration'] = new Date(record['updated']) - new Date(record['created'])
							} else if (step === '$cond') {
								if ('$lt' in project[field][step]['if']) {
									if (record['duration'] < project[field][step]['if']['$lt'][1]) {
										record['duration'] = 7500
									}
								} else {
									console.error(`ERROR: No support for ${ project[field][step]['if'] } within $project -> ${ field } -> $cond`)
								}
							} else {
								console.error(`ERROR: No support for ${ step } within $project -> ${ field }`)
							}
						}
					} else if (field !== 'created') {
						console.error(`ERROR: No support for ${ field } within $project`)
					}
				}
			}
		} else if ('$sort' in task) {
			const sort = task['$sort']
			for (const field in sort) {
				results.sort((a, b) => {
					return sort[field] * (a[field] - b[field])
				})
			}
		} else if ('$limit' in task) {
			if (results.length > task['$limit']) {
				results = results.slice(0, task['$limit'])
			}
		} else if ('$count' in task) {
			return [{ count: results.length }]
		} else {
			// Uh-oh, I don't support this yet!
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

module.exports = Record