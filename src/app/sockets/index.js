'use strict';

import _ from 'lodash';
import socket from 'socket.io';
import bacon from 'baconjs';
import CellFactory from '../models/cellFactory';
import SpreadSheetFactory from '../models/spreadSheetFactory';
//import logger from '../helpers/logger';

// export sockets
export default function (server) {
	const Bacon = bacon.Bacon;
	const io = socket(server);

	// set basic routes
	var connections = Bacon.fromBinder(function (sink) {
		io.on('connect', sink);
	});

	var spreadSheet = null;
	var height = 10;
	var width = 10;
	var granularity = 60000;

	function getTimestamp(factor) {
		factor = factor || granularity;
		factor = factor > 0 ? factor : 1;
		return Math.round((new Date())
			.getTime() / factor) * factor;
	}

	function newSpreadSheet() {
		var cells = [];
		for (let i = 1; i < height; i++) {
			for (let j = 1; j < width; j++) {
				let cellName = String.fromCharCode("A".charCodeAt(0) + j - 1) + i;
				let cell = CellFactory.getNewCell({
					id: cellName
				});
				cells.push(cell);
			}
		}
		return SpreadSheetFactory.getSpreadSheet(cells);
	}

	var messages = connections.flatMap(function (client) {
		return Bacon.fromBinder(function (sink) {
			client.on('join', function (data) {
				var userid = {
					userid: client.id,
					cells: null,
					transaction_id: getTimestamp(1),
					height: height,
					width: width
				};
				if (io.engine.clientsCount === 1 || !spreadSheet) {
					spreadSheet = newSpreadSheet();
				}
				userid.cells = spreadSheet.getCells();
				client.emit('userid', userid);
				sink({
					type: 'join',
					data: client.id,
					transaction_id: userid.transaction_id
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

			client.on('timestampInterval', function (data) {
				var test = parseInt(data.timestampInterval, 10);

				if (_.isNumber(test) && _.isFinite(test)) {
					test = Math.max(test, 1);
					test = Math.min(test, 120000);
				} else {
					test = granularity;
				}
				granularity = test;
				data.timestampInterval = granularity;

				io.emit('timestampInterval', data);
				data.transaction_id = getTimestamp(1);
				sink({
					type: 'timestampInterval',
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
				if (/connect/i.test(label)) {
					console.log(label, value);
				} else if (label === 'message') {
					//label = logMessages(value);
					console.log('logMessages:', label, value);
				}
			}
		});
}
