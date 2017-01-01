'use strict';

import mongoose from 'mongoose';

// create new schema
const schema = new mongoose.Schema({
	type: {
		type: String
	},
	data: {
		timestampMode: Boolean,
		user_id: String,
		transaction_id: Number
	}
}, {
	strict: false
});
// virtual date attribute
schema.virtual('date')
	.get(() => this._id.getTimestamp());
// assign schema to 'Sheet'
mongoose.model('TimestampMode', schema);
