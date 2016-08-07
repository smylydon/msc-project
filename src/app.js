'use strict';

// built-in
import path from 'path';
// external
import bodyParser from 'body-parser';
import compress from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
//import mongoose from 'mongoose';
import favicon from 'serve-favicon';
// local
//import './app/models'; // this MUST be done before controllers
import config from './config';
import controllers from './app/controllers';
import logger from './app/helpers/logger';
import handlebars from 'express-handlebars';
import socket from 'socket.io';

// EXPRESS SET-UP
// create app
const app = express();
// use jade and set views and static directories

app.set('views', path.join(config.root, 'app/views'));
app.engine('hbs', handlebars({
	extname: '.hbs',
	defaultLayout: path.join(config.root, 'app/views/layout/layout')
}));
app.set('view engine', '.hbs');
app.use(express.static(path.join(config.root, 'static')));
//add middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(compress());
app.use(cookieParser());
app.use(favicon(path.join(config.root, 'static/img/favicon.png')));
app.use(helmet());
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
	res.setHeader('Access-Control-Allow-Headers',
		'X-Requested-With, Content-Type, Authorization');
	next();
});
// set all controllers
app.use('/', controllers);
// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// general errors

app.use((err, req, res, next) => {
	const sc = err.status || 500;
	res.status(sc);
	res.render('error', {
		status: sc,
		message: err.message,
		stack: config.env === 'development' ? err.stack : ''
	});
});
console.log('testing console.log');

// START AND STOP
const server = app.listen(config.port, () => {
	logger.info(`listening on port ${config.port}`);
});

const io = socket(server);

// set basic routes
io.on('connect', function (client) {
	console.log('a user connected');
	client.on('join', function (data) {
		console.log('client join:',data);
		client.emit('messages', 'Hello from server');
	});
});

process.on('SIGINT', () => {
	logger.info('shutting down!');
	server.close();
	process.exit();
});
