'use strict';

import socket from 'socket.io';

// export sockets
export default function (server) {
	const io = socket(server);

	// set basic routes
	io.on('connect', function (client) {
		client.on('join', function (data) {
			var timestamep = (new Date())
				.getTime();
			client.emit('userid', timestamep);
			console.log('join:', timestamep);
		});

		client.on('write', function (data) {
			data.timestamep = (new Date())
				.getTime();
			console.log('write:', data);
			client.emit('update', data);
		});
	});
}
