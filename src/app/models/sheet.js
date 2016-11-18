'use strict';

import mongoose from 'mongoose';

// create new schema
const schema = new mongoose.Schema({
  title: String,
  updated: Number,
  cells: {}
},{strict: false});
// virtual date attribute
schema.virtual('date').get(() => this._id.getTimestamp());
// assign schema to 'Sheet'
mongoose.model('Sheet', schema);
