'use strict';

import _ from 'lodash';
import socket from 'socket.io';
import bacon from 'baconjs';
import mongoose from 'mongoose';
import CellFactory from '../models/cellFactory';
import SpreadSheetFactory from '../models/spreadSheetFactory';
//import logger from '../helpers/logger';

// export sockets
export default function (server) {
	const Bacon = bacon.Bacon;
	const io = socket(server);
	const Join = mongoose.model('Join');
	const TimestampInterval = mongoose.model('TimestampInterval');
	const TimestampMode = mongoose.model('TimestampMode');
	const UpdateResult = mongoose.model('UpdateResult');
	const UpdateAttempt = mongoose.model('UpdateAttempt');
	const mapOfModels = new Map([
		["join", Join],
		["timestampInterval", TimestampInterval],
		["timestampMode", TimestampMode],
		["write", UpdateAttempt],
		["frontend-log", UpdateResult]
	]);

	function callback(model) {
		return function (err, message) {
			if (err) {
				console.log('Error ' + message + ' :', err);
			}
		};
	}

	function handleResult(model) {
		return callback(' saving ' + model);
	}

	function removed(model) {
		return callback(' removing ' + model + ' collection');
	}

	mapOfModels.forEach(function (value, key) {
		console.log('key is:', key);
		value.remove({}, removed(key));
	});

	// set basic routes
	var connections = Bacon.fromBinder(function (sink) {
		io.on('connect', sink);
	});

	var spreadSheet = null; // in memory spreadSheet
	var height = 10;
	var width = 10;
	var granularity = 60000; // default timestamp granularity
	var timestampMode = false;

	/**
	 * @function getTimestamp
	 * @description
	 * Returns a timestamp, the granularity is determined by the
	 * factor parameter.
	 *
	 * @param {Number} factor is the granularity in milliseconds default 60000ms
	 * @return {Number} a timestamp
	 */
	function getTimestamp(factor) {
		factor = factor || granularity;
		factor = factor > 0 ? factor : 1; // careful division by zero
		return Math.round((new Date())
			.getTime() / factor) * factor;
	}

	/**
	 * @function newSpreadSheet
	 * @description
	 * Generates an in memory spreadsheet.
	 *
	 * @param {Number} width
	 * @param {Number} height
	 * @return {Object} a new instance of a spreadsheet
	 */
	function newSpreadSheet(width, height) {
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
		//Create custom event stream
		return Bacon.fromBinder(function (sink) {
			client.on('join', function (data) {
				var userid = {
					user_id: client.id,
					cells: null,
					transaction_id: getTimestamp(1),
					height: height,
					width: width,
					granularity: granularity,
					timestampMode: timestampMode
				};

				//on first connection create new spreadsheet.
				if (io.engine.clientsCount === 1 || !spreadSheet) {
					spreadSheet = newSpreadSheet(width, height);
				}

				userid.cells = spreadSheet.getCells();
				client.emit('userid', userid);
				sink({
					type: "join",
					data: client.id,
					transaction_id: userid.transaction_id
				});
			});

			//client attempting to write a value (update attempt).
			client.on('write', function (data) {
				data.type = "update";
				data.timestamp = data.browserTimestamp ? data.timestamp : getTimestamp();
				data.transaction_id = getTimestamp(1);

				io.emit("update", data);
				sink({
					type: "write",
					data: data
				});
			});

			//receiving client log
			client.on('log', function (data) {
				data.type = "log";
				sink({
					type: "frontend-log",
					data: data
				});
			});

			//receiving new timestamp mode from client
			client.on('timestampMode', function (data) {
				io.emit('timestampMode', data);
				data.transaction_id = getTimestamp(1);
				timestampMode = Boolean(data.timestampMode);
				sink({
					type: "timestampMode",
					data: data
				});
			});

			//receiving new timestamp interval from client
			client.on('timestampInterval', function (data) {
				var test = parseInt(data.timestampInterval, 10);

				if (_.isNumber(test) && _.isFinite(test)) {
					test = Math.max(test, 1);
					test = Math.min(test, 120000);
					granularity = test;
				}

				data.timestampInterval = granularity;

				io.emit('timestampInterval', data);
				data.transaction_id = getTimestamp(1);
				sink({
					type: "timestampInterval",
					data: data
				});
			});
		});
	});

	/**
	 * @function updateCell
	 * @description
	 * Saves successful update to in memory spreadsheet.
	 *
	 * @param {Object} cell data
	 */
	function updateCell(data) {
		if (data && data.update === 'success') {
			let cell = spreadSheet.getCellById(data.cell_id);
			if (cell) {
				cell.value = data.value;
				cell.formula = data.formula;
			}
		}
	}

	function tag(label) {
		return function (value) {
			return [label, value];
		};
	}

	function noOp() {
		this.save = function (callback) {
			console.log('save dummy');
		};
	}

	/**
	 * @function updateMongo
	 * @description
	 * Saves data to MongoDb. The nameOfModel is used to find a model
	 * a Map of all the models. The noOp function is here for safety.
	 *
	 * @param {String} name of model to update
	 * @param {Object} data to update
	 */
	function updateMongo(nameOfModel, value) {
		let aModel = mapOfModels.get(nameOfModel) || noOp;
		let model = new aModel(value);
		model.save(handleResult(nameOfModel));
	}

	Bacon.mergeAll(
			connections.map(function (value) {
				return tag('connect' + value.id);
			}),
			messages.map(tag('message'))
		)
		.onValues(function (label, value) {
			if (label) {
				if (/connect/i.test(label)) {
					console.log(label, value);
				} else if (label === 'message') {
					var type = value.type;
					if (value.type === 'frontend-log') {
						updateCell(value.data);
					}
					updateMongo(type, value);
				}
				console.log('data:', label, value);
			}
		});
}
