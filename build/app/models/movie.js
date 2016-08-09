'use strict';

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create new schema
var schema = new _mongoose2.default.Schema({
  title: String,
  year: Number,
  url: String,
  text: String
});
// virtual date attribute
schema.virtual('date').get(function () {
  return undefined._id.getTimestamp();
});
// assign schema to 'Movie'
_mongoose2.default.model('Movie', schema);