'use strict';

import socket from 'socket.io';
//import redis from 'redis';
import bacon from 'baconjs';
//import logger from '../helpers/logger';

// export sockets
export default function (server) {
	const Bacon = bacon.Bacon;
	const io = socket(server);
	//const redisClient = redis.createClient();
	/*
		redisClient.on('connect', function (error, value) {
			logger.info('connected to redis');
		});
	*/
	// set basic routes
	var connections = Bacon.fromBinder(function (sink) {
		io.on('connect', sink);
	});

	function getTimestamp(factor) {
		factor = factor || 60000;
		return Math.round((new Date())
			.getTime() / factor) * factor;
	}

	var messages = connections.flatMap(function (client) {
		return Bacon.fromBinder(function (sink) {
			client.on('join', function (data) {
				client.emit('userid', client.id);
				sink({
					type: 'join',
					data: client.id,
					transaction_id: getTimestamp(1)
				});
			});

			client.on('write', function (data) {
				data.type = "update";
				data.timestamp = data.browserTimestamp ? data.timestamp : getTimestamp();
				data.transaction_id = getTimestamp(1);

				io.emit('update', data);
				sink({
					type: 'write',
					data: data
				});
			});

			client.on('log', function (data) {
				data.type = "log";
				sink({
					type: 'frontend-log',
					data: data
				});
			});

			client.on('timestampMode', function (data) {
				io.emit('timestampMode', data);
				data.transaction_id = getTimestamp(1);
				sink({
					type: 'timestampMode',
					data: data
				});
			});

		});
	});

	function tag(label) {
		return function (value) {
			return [label, value];
		};
	}
	/*
			function logMessages(value) {
				var label = 'message';
				var type = value.type;

				switch (type) {
				case 'join':
					label = type + value.data;
					break;
				case 'update':
				case 'write':
					label = 'update' + value.data.user_id + '_' + value.data.element;
					break;
				}
				return label;
			}
	*/
	Bacon.mergeAll(
			connections.map(function (value) {
				return tag('connect' + value.id);
			}),
			messages.map(tag('message'))
		)
		.onValues(function (label, value) {
			if (label) {
				//logger.info( label, value);
				console.log(label, value);
				/*
				if (/connect/i.test(label)) {
					redisClient.set(label, label.replace('connect',''));
					redisClient.expire(label, 86400);
				} else if (label === 'message') {
					label = logMessages(value);
					redisClient.set(label, JSON.stringify(value));
					redisClient.expire(label, 3600);
				}*/
			}
		});
}
