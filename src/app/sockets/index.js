'use strict';

import socket from 'socket.io';
import redis from 'redis';
import bacon from 'baconjs';
import logger from './app/helpers/logger';

// export sockets
export default function (server) {
	const Bacon = bacon.Bacon;
	const io = socket(server);
	const redisClient = redis.createClient();

	redisClient.on('connect', function (error, value) {
		console.log('connected to redis');
	});

	// set basic routes
	var connections = Bacon.fromBinder(function (sink) {
		io.on('connect', sink);
	});

	var messages = connections.flatMap(function (client) {
		return Bacon.fromBinder(function (sink) {
			client.on('join', function (data) {
				var timestamep = (new Date())
					.getTime();
				client.emit('userid', timestamep);
				sink({
					type: 'join',
					data: timestamep
				});
			});
			client.on('write', function (data) {
				data.type = "update";
				data.timestamep = (new Date())
					.getTime();
				io.emit('update', data);
				sink({
					type: 'write',
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

	Bacon.mergeAll(
		connections.map(tag('connect')),
		messages.map(tag('message'))
	).onValues(function (label, value) {
		if (label === 'connect') {
			redisClient.set(label, value.id);
		} else {
			redisClient.set(label, JSON.stringify(value));
			logger.info(redisClient.get(label));
		}
	});
}
