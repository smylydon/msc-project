'use strict';

import mongoose from 'mongoose';

// create new schema
const schema = new mongoose.Schema({
	type: String,
	data: {
		cell_id: String,
		formula: String,
		user_id: String,
		browserTimestamp: Boolean,
		timestamp: Number,
		type: {type:String},
		transaction_id: Number
	}
}, {
	strict: false
});
// virtual date attribute
schema.virtual('date')
	.get(() => this._id.getTimestamp());
// assign schema to 'Sheet'
mongoose.model('UpdateAttempt', schema);
