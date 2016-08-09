'use strict';

// built-in

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _compression = require('compression');

var _compression2 = _interopRequireDefault(_compression);

var _cookieParser = require('cookie-parser');

var _cookieParser2 = _interopRequireDefault(_cookieParser);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _helmet = require('helmet');

var _helmet2 = _interopRequireDefault(_helmet);

var _expressHandlebars = require('express-handlebars');

var _expressHandlebars2 = _interopRequireDefault(_expressHandlebars);

var _serveFavicon = require('serve-favicon');

var _serveFavicon2 = _interopRequireDefault(_serveFavicon);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _controllers = require('./app/controllers');

var _controllers2 = _interopRequireDefault(_controllers);

var _sockets = require('./app/sockets');

var _sockets2 = _interopRequireDefault(_sockets);

var _logger = require('./app/helpers/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// EXPRESS SET-UP
// create app

// local
var app = (0, _express2.default)();
// use jade and set views and static directories

//import mongoose from 'mongoose';

// external
app.set('views', _path2.default.join(_config2.default.root, 'app/views'));
app.engine('hbs', (0, _expressHandlebars2.default)({
	extname: '.hbs',
	defaultLayout: _path2.default.join(_config2.default.root, 'app/views/layout/layout')
}));
app.set('view engine', '.hbs');
app.use(_express2.default.static(_path2.default.join(_config2.default.root, 'static')));
//add middlewares
app.use(_bodyParser2.default.json());
app.use(_bodyParser2.default.urlencoded({
	extended: false
}));
app.use((0, _compression2.default)());
app.use((0, _cookieParser2.default)());
app.use((0, _serveFavicon2.default)(_path2.default.join(_config2.default.root, 'static/img/favicon.png')));
app.use((0, _helmet2.default)());
app.use(function (req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
	next();
});
// set all controllers
app.use('/', _controllers2.default);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// general errors
app.use(function (err, req, res, next) {
	var sc = err.status || 500;
	res.status(sc);
	res.render('error', {
		status: sc,
		message: err.message,
		stack: _config2.default.env === 'development' ? err.stack : ''
	});
});

// START AND STOP
var server = app.listen(_config2.default.port, function () {
	_logger2.default.info('listening on port ' + _config2.default.port);
});

(0, _sockets2.default)(server);

process.on('SIGINT', function () {
	_logger2.default.info('shutting down!');
	server.close();
	process.exit();
});