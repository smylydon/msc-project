'use strict';
// this controller is meant to set up routes from all other controllers
// it also sets up basic express routes

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _express = require('express');

//import extrasController from './extras';

// create router
var router = (0, _express.Router)();
// load other controllers
//router.use('/extras', extrasController);

// set basic routes
router.get('/', function (req, res) {
  return res.render('index', {
    title: 'msc-project'
  });
});

// export router
exports.default = router;