'use strict';
// this controller is meant to set up routes from all other controllers
// it also sets up basic express routes

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _express = require('express');

var _socket = require('socket.io');

var _socket2 = _interopRequireDefault(_socket);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create router
var router = (0, _express.Router)();

// set basic routes
_socket2.default.on('/connect', function (socket) {
  console.log('a user connected');
});

// export router
exports.default = router;