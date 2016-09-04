'use strict';

import socket from 'socket.io';
import redis from 'redis';
import bacon from 'baconjs';

// export sockets
export default function (server) {
	const Bacon = bacon.Bacon;
	const io = socket(server);
	const redisClient = redis.createClient();

	redisClient.on('connect', function (error, value) {
		console.log('connected to redis');
	});

	redisClient.set('test', 'test');

	redisClient.get('test', function (error, value) {
		console.log('test:', error, value);
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
				sink({type: 'join', data: data});
			});
			client.on('write', function(data) {
				data.type = "update";
				data.timestamep = (new Date())
					.getTime();
				io.emit('update', data);
				sink({type: 'write', data: data});
			});
		});
	});

	messages.onValue(function (data) {
		//console.log(data);
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
			console.log('merging:', label, value.id);
			redisClient.set(label, value.id);
		} else {
			console.log('mergeing:', label, value);
			redisClient.set(label, value);
		}
	});
}
