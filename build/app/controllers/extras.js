'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _express = require('express');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create router and set routes
var router = (0, _express.Router)();
router.get('/', function (req, res, next) {
  return res.render('extras', {
    message: 'welcome to extras!',
    base: true
  });
});
router.get('/:message', function (req, res, next) {
  return !req.params.hasOwnProperty('message') ? res.status(404).end() : res.render('extras', {
    message: 'welcome to extras!\n        you are currently at ' + _path2.default.join('extras', req.params.message),
    base: false
  });
});

// export router
exports.default = router;