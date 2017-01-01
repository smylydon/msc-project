/* eslint-disable */
var _ = _;
var Bacon = Bacon;
var io = io;
/* eslint-enable */

function noOp() {} //create it once since it is used multiple times

/*
 * CellFactory
 */
var CellFactory = (function () {
	/**
	 * @Constructor
	 *
	 * @param {Object} json object containing cell data
	 */
	function Cell(data) {
		this.id = data.id;
		this.element = data.element;
		this.value = 0;
		this.formula = "";
		this.expanded = "0";
		this.lastUpdated = 0;
		this.dispose = noOp;
		this.bus = new Bacon.Bus();
	}

	/**
	 * @method pusher
	 * @description
	 * Pushes the current value to all subscribers.
	 */
	Cell.prototype.pusher = function (pusherId) {
		this.bus.push({
			value: this.value,
			pusher_id: pusherId
		});
	};

	return {
		getNewCell: function (data) {
			return new Cell(data);
		}
	};
})();

/*
 * SpreadSheetFactory
 */
var SpreadSheetFactory = (function () {
	/**
	 * @Constructor
	 *
	 * @param {Array} optional array containing cell data.
	 */
	function SpreadSheet(cells) {
		this.cells = [];
		this.addCells(cells);
		this.browserTimestamp = false;
	}

	/**
	 * @method getCellById
	 * @description
	 * Returns the the first cell taht match the id
	 * or returns undefined.
	 *
	 * @param {string} id of cell
	 * @returns {Cell}
	 */
	SpreadSheet.prototype.getCellById = function (id) {
		return _.find(this.cells, {
			id: id
		});
	};

	/**
	 * @method addCells
	 * @description
	 * Accepts an array of json objects. A collection of
	 * Cell objects are create using the json objects.
	 * The cells are added to collection of spreadsheet
	 * cells.
	 *
	 * @param {Array} an array of json objects
	 */
	SpreadSheet.prototype.addCells = function (cells) {
		cells = _.isArray(cells) ? cells : [];
		cells = cells.map(function (data) {
			return CellFactory.getNewCell(data);
		});
		Array.prototype.push.apply(this.cells, cells);
	};

	/**
	 * @method addCell
	 * @description
	 * Accepts a json objects. Creates a cell object and
	 * adds it to the collection of cells.
	 *
	 * @param {Array} a json
	 */
	SpreadSheet.prototype.addCell = function (data) {
		this.cells.push(CellFactory.getNewCell(data));
	};

	/**
	 * @method removeCellsById
	 * @description
	 * Accepts a list of cell ids. Cells matching each
	 * are removed one at a time from the collection
	 * of spreatsheet cells.
	 *
	 * @param {Array} a list of ids to remove
	 */
	SpreadSheet.prototype.removeCellsById = function (ids) {
		var that = this;
		ids = _.isArray(ids) ? ids : [];
		_.forEach(ids, function (id) {
			that.removeCellById(id);
		});
	};

	/**
	 * @method removeCellById
	 * @description
	 * Accepts an id of a cell that needs to be removed.
	 * Cells that match the id are removed one at a time
	 * from the collection of spreatsheet cells.
	 *
	 * @param {String} id the id of the cell to be removed
	 */
	SpreadSheet.prototype.removeCellById = function (id) {
		_.remove(this.cells, function (cell) {
			return cell.id === id;
		});
	};

	return {
		getSpreadSheet: function (cells) {
			return new SpreadSheet(cells);
		}
	};

})();

var spreadSheet = null;

function contrainValue(value, min, max) {
	min = min || 0;
	max = max || 10;
	value = _.isFinite(value) ? value : 1;
	value = Math.max(min, value);
	value = Math.min(max, value);
	return value;
}

/**
 * @function drawSpreadSheet
 *
 * @param {int} width
 * @param {int} height
 */
function drawSpreadSheet(width, height) {
	var table = document.querySelector("table");
	width = contrainValue(width, 1, 27);
	height = contrainValue(height, 1, 20);

	while (table.firstChild) {
		table.removeChild(table.firstChild);
	}

	for (let i = 0; i < height; i++) {
		let row = table.insertRow(-1);
		for (let j = 0; j < width; j++) {
			let letter = String.fromCharCode("A".charCodeAt(0) + j - 1);
			row.insertCell(-1)
				.innerHTML = i && j ? "<input id='" + letter + i +
				"' class='spreadsheet-cell' />" :
				i || letter;
		}
	}
}

var granularity = 60000;

/**
 * @function getTimestamp
 * @description
 * Takes a factor that determines the granularity of the generated
 * timestamp. The default is 60000 milliseconds
 *
 * @param {Number} timestampe granularity in milliseconds
 * @return {Number} timestamp
 */
function getTimestamp(factor) {
	factor = factor || granularity;
	factor = factor > 0 ? factor : 1;
	return Math.round((new Date())
		.getTime() / factor) * factor;
}

var INPUTS = false;
var cells = [];

function processPusherId(value, a, b) {
	var pusherId1 = a.pusher_id;
	var pusherId2 = b.pusher_id;
	var obj = {
		value: value
	};

	if (pusherId1 === "self" || pusherId2 === "self") {
		obj.pusher_id = "self";
	} else if (pusherId1 === "const" || _.isNull(pusherId2)) {
		obj.pusher_id = "const";
	} else if (_.isNull(pusherId1) || pusherId2 === "const") {
		obj.pusher_id = "const";
	} else if (pusherId1 === pusherId2) {
		obj.pusher_id = pusherId1;
	}
	return obj;
}

/**
 * @function processElements
 *
 * @param {Object} socketUpdate stream
 * @param {Object} timestampModeUpdate stream
 */
function processElements(socketUpdate, timestampModeUpdate, timestampIntervalUpdate) {
	function add(a, b) {
		return processPusherId(a.value + b.value, a, b);
	}

	function minus(a, b) {
		return processPusherId(a.value - b.value, a, b);
	}

	function multiply(a, b) {
		return processPusherId(a.value * b.value, a, b);
	}

	/**
	 * @function divide
	 * @description
	 * Divides a by b. Checks for division by zero.
	 *
	 * @param {Number} a
	 * @param {Number} b
	 * @return {Object} a new stream
	 */
	function divide(a, b) {
		var value;
		if (b.value === 0) {
			value = "#ERROR DIVISION BY ZERO ERROR";
		} else {
			value = a.value / b.value;
		}
		return processPusherId(value, a, b);
	}

	function power(a, b) {
		return processPusherId(Math.pow(a.value, b.value), a, b);
	}

	/**
	 * @function fetchAndCombine
	 * @description
	 *
	 *
	 * @param {Object} a token
	 * @param {Function} combiner - combinator function.
	 * @param {Array} pusher - array of cells to push.
	 * @return {Object} a new stream
	 */
	function fetchAndCombine(token, combiner, pushers) {
		var right = "";
		var left = calculate(token.left, pushers);

		if (token.right) {
			right = calculate(token.right, pushers);
		} else {
			right = createConstant(0);
		}
		return left.combine(right, combiner);
	}

	/**
	 * @function createConstant
	 * @description
	 * Accepts a number and returns a Bacon property.
	 *
	 * @param {Number} value - a number
	 * @return {Object} a new property
	 */
	function createConstant(value) {
		return Bacon.constant({
			value: Number(value),
			pusher_id: "const"
		});
	}

	/**
	 * @function calculate
	 * @description
	 * Recursive function that creates a reactive relations given a token.
	 *
	 *
	 * @param {Object} a token
	 * @param {Array} pusher - array of cells to push.
	 * @return {Object} a new stream
	 */
	function calculate(token, pushers) {
		var left = 0;
		var right = 0;
		var value = 0;

		if (token.type === "number") {
			value = createConstant(token.token);
		} else if (token.type === "cellname") {
			value = spreadSheet.getCellById(token.token);
			pushers.push(value);
			value = value.bus;
		} else if (token.type === "unary") {
			right = calculate(token.right, pushers);
			if (token.token === "+") {
				value = right;
			} else {
				left = createConstant(0);
				value = left.combine(right, minus);
			}
		} else if (token.type === "leftparen") {
			left = calculate(token.left, pushers);
			right = token.right;
			if (right.type === "rightparen") {
				value = left;
			}
		} else if (token.type === "operator") {

			switch (token.token) {
			case "+":
				value = fetchAndCombine(token, add, pushers);
				break;
			case "-":
				value = fetchAndCombine(token, minus, pushers);
				break;
			case "*":
				value = fetchAndCombine(token, multiply, pushers);
				break;
			case "/":
				value = fetchAndCombine(token, divide, pushers);
				break;
			case "^":
				value = fetchAndCombine(token, power, pushers);
				break;
			}
		}
		return value;
	}

	function updateCell(setter) {
		var cell = setter.cell;
		var element = setter.element;

		cell.value = setter.value;
		if (element.is(":focus")) {
			element.val(cell.formula);
		} else {
			element.val(cell.value);
		}
		localStorage[cell.id] = cell.formula;
		cell.lastUpdated = setter.timestamp;
		log({
			cell: cell,
			update: "success",
			action: "brower cell update",
			transaction_id: setter.transaction_id
		});
		cell.pusher("self");
	}

	/**
	 * @function log
	 * @description
	 * Send log to server to be save in database.
	 *
	 * @param {Object} a setter object containing data on update
	 * @return void
	 */
	function log(setter) {
		var cell = setter.cell;
		var action = setter.action || "update";
		var obj = {
			cell_id: cell.id,
			formula: cell.formula,
			value: cell.value,
			user_id: userId,
			update: setter.update,
			action: action,
			transaction_id: setter.transaction_id
		};
		console.log(obj);
		socket.emit("log", obj);
	}

	INPUTS.each(function (index, elem) {
		var element = $(elem);
		var model = {
			element: element,
			id: element.attr("id")
		};
		var pushers = [];

		cells.push(model);

		socketUpdate.filter(function (data) {
				return data.cell_id === model.id;
			})
			.onValue(function (data) {
				var cell = spreadSheet.getCellById(data.cell_id);
				var value = data.formula.toUpperCase();
				var cellId = cell.id;
				var timestamp = data.timestamp;
				var count = 0;
				var performUpdate = function (value) {
					updateCell({
						cell: cell,
						element: element,
						value: value,
						transaction_id: data.transaction_id,
						timestamp: timestamp
					});
				};

				//guard against old updates from server by
				//comparing timestamps
				if (timestamp > cell.lastUpdated) {
					pushers = [];
					cell.formula = value;
					cell.dispose(); //dispose last frp relation
					cell.dispose = noOp;
					if (_.isUndefined(value) || value === "") {
						performUpdate(0);
						cell.expanded = "0";
					} else {
						value = window.parser.parse(value.replace("=", ""), cell.id);
						if (_.isString(value) && /ERROR/ig.test(value)) {
							performUpdate(value);
						} else {
							cell.dispose = calculate(value, pushers)
								.onValue(function (result) {
									if (!_.isNumber(result)) {
										var pusherId = _.trim(result.pusher_id);
										if (/^(self|const)$/ig.test(pusherId) || pusherId === cellId) {
											timestamp = count > 0 ? (new Date())
												.getTime() : timestamp;
											count++;
											performUpdate(result.value);
										}
									}
								});

							//calulate initial value of cell
							//by manually pushing the values of
							//dependent cells.
							_(pushers)
								.uniqBy(function (aCell) {
									return aCell.id;
								})
								.forEach(function (aCell) {
									aCell.pusher(cellId);
								});

							//empty array of all cells
							pushers.length = 0;
						}
					}
				} else {
					log({
						cell: cell,
						update: "fail",
						action: "brower cell update",
						transaction_id: data.transaction_id
					});
				}
			});

		//subscribe to cells focus event
		element.asEventStream("focus")
			.onValue(function (event) {
				var elementid = event.target.id;
				var cell = spreadSheet.getCellById(elementid);
				var value = cell.formula || "";
				element.val(value);
			});

		//1.subscribe to cells blur event
		//2.send data to server.
		element.asEventStream("blur")
			.map(function (event) {
				var elementid = event.target.id;
				var formula = event.target.value;
				var browserTimestamp = spreadSheet.browserTimestamp;
				var cell = spreadSheet.getCellById(elementid);
				element.val(cell.value || 0);
				return {
					cell_id: elementid,
					formula: formula,
					user_id: userId,
					browserTimestamp: browserTimestamp,
					timestamp: browserTimestamp ? getTimestamp() : 0
				};
			})
			.onValue(function (data) {
				socket.emit("write", data);
			});
	});

	spreadSheet.addCells(cells);
	window.parser.setSpreadSheet(spreadSheet);
	//subscribe to socket update events
	socketUpdate.onValue(function (data) {
		//console.log('update:', data);
	});
}

/**
 * @function subscibeCustomStreams
 * @description
 * This function takes care of the timestamp mode and timestamp granularity.
 *
 * @param {Object} timestampModeUpdate custom stream
 * @param {Object} timestampIntervalUpdate custom stream
 */
function subscibeCustomStreams(timestampModeUpdate, timestampIntervalUpdate) {
	//1.Get timestampMode checkbox.
	//2.Subscribe to event stream.
	//3.Send status to server.
	var timestampMode = $("#timestampMode");
	timestampMode
		.asEventStream("click")
		.map(function (event) {
			return event.currentTarget.checked;
		})
		.onValue(function (data) {
			spreadSheet.browserTimestamp = data;
			socket.emit("timestampMode", {
				timestampMode: data,
				user_id: userId
			});
		});

	//subscribe to timestamp mode update events
	timestampModeUpdate.onValue(function (data) {
		var mode = data.timestampMode;
		spreadSheet.browserTimestamp = mode;
		timestampMode.prop("checked", mode);
	});

	function calculateInterval(data) {
		var test = parseInt(data, 10);

		if (_.isNumber(test) && _.isFinite(test)) {
			test = Math.max(test, 1);
			test = Math.min(test, 120000);
		} else {
			test = 0;
		}
		return test;
	}

	//1.Get timestampInterval.
	//2.Subscribe to event stream.
	//3.Send status to server.
	var timestampInterval = $("#timestampInterval");
	timestampInterval
		.asEventStream("blur")
		.map(function (event) {
			return event.currentTarget.value;
		})
		.onValue(function (data) {
			var value = calculateInterval(data);
			if (value) {
				socket.emit("timestampInterval", {
					timestampInterval: value
				});
				granularity = value;
			}
			timestampInterval.val(granularity);
		});

	//subscribe to timestampgranularity update events
	timestampIntervalUpdate.onValue(function (data) {
		var value = calculateInterval(data.timestampInterval);
		granularity = value ? value : granularity;
		timestampInterval.val(granularity);
	});
}

var userId;
/* eslint-disable */
var socket = io(); //io.connect('http://localhost:5000');
/* eslint-enable */

/**
 * @function fromBinderStream
 * @description
 * Given a name of a socket.io event. The is wrapped in a custom BaconJs stream
 * using the fromBinder operator.
 *
 * @param {String eventName name of socket.io event
 * @returns {Object} custom BaconJs stream
 */
function fromBinderStream(eventName) {
	return Bacon.fromBinder(function (sink) {
		socket.on(eventName, function (data) {
			sink(data);
		});
	});
}

// 1. Connects to the server.
// 2. Get userid from server.
// 3. Create custom stream for socket update event.
// 4. Create custom stream for timestamp mode event.
// 5. Call processElements to start spreadsheet app.
socket.on("connect", function (data) {
	window.parser.setSocket(socket); //need it for logging

	socket.emit("join", "Hello World from client");

	socket.on("userid", function (data) {
		userId = data.user_id;

		drawSpreadSheet(parseInt(data.width), parseInt(data.height));
		INPUTS = $(".spreadsheet-cell"); //get all inputs

		spreadSheet = SpreadSheetFactory.getSpreadSheet();
		var socketUpdate = fromBinderStream("update");
		var timestampModeUpdate = fromBinderStream("timestampMode");
		var timestampIntervalUpdate = fromBinderStream("timestampInterval");

		//pass custom streams
		processElements(socketUpdate);
		subscibeCustomStreams(timestampModeUpdate, timestampIntervalUpdate);
		console.log('data is:', data);
		_.forEach(data.cells, function (serverCell) {
			let cell = spreadSheet.getCellById(serverCell.id);
			if (cell) {
				cell.lastUpdated = serverCell.lastUpdated;
				cell.formula = serverCell.formula;
				cell.expanded = serverCell.expanded;
				cell.value = serverCell.value;
				let element = cell.element;
				if (element.is(":focus") || cell.formula === "") {
					element.val(cell.formula);
				} else {
					element.val(cell.value);
				}
			}
		});
	});
});
