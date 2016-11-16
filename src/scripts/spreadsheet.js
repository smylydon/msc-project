/* eslint-disable */
var _ = _;
var Bacon = Bacon;
/* eslint-enable */

/*
 * CellFactory
 */
var CellFactory = (function () {
	/*
	 * Constructor
	 *
	 * param {Object} json object containing cell data
	 */
	function Cell(data) {
		this.id = data.id;
		this.element = data.element;
		this.value = 0;
		this.expanded = '0';
		this.lastUpdated = 0;
		this.dispose = null;
		this.bus = new Bacon.Bus();
	}

	/*
	 * pusher
	 *
	 * Pushes the current value to all subscribers.
	 *
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
	/*
	 * Constructor
	 *
	 * param {Array} optional array containing cell data.
	 */
	function SpreadSheet(cells) {
		this.cells = [];
		this.addCells(cells);
	}

	/*
	 * getCellById
	 *
	 * Returns the the first cell taht match the id
	 * or returns undefined.
	 *
	 * param {string} id of cell
	 * return {Cell}
	 */
	SpreadSheet.prototype.getCellById = function (id) {
		return _.find(this.cells, {
			id: id
		});
	};

	/*
	 * addCells
	 *
	 * Accepts an array of json objects. A collection of
	 * Cell objects are create using the json objects.
	 * The cells are added to collection of spreadsheet
	 * cells.
	 *
	 * param {Array} an array of json objects
	 */
	SpreadSheet.prototype.addCells = function (cells) {
		cells = _.isArray(cells) ? cells : [];
		cells = cells.map((data)=> CellFactory.getNewCell(data));
		Array.prototype.push.apply(this.cells, cells);
	};

	SpreadSheet.prototype.addCell = function (data) {
		this.cells.push(CellFactory.getNewCell(data));
	};

	/*
	 * removeCellsById
	 *
	 * Accepts a list of cell ids. Cells matching each
	 * are removed one at a time from the collection
	 * of spreatsheet cells.
	 *
	 * param {Array} a list of ids to remove
	 */
	SpreadSheet.prototype.removeCellsById = function (ids) {
		var that = this;
		ids = _.isArray(ids) ? ids : [];
		_.forEach(ids, function (id) {
			that.removeCellById(id);
		});
	};

	/*
	 * removeCellById
	 *
	 * Accepts an id of a cell that needs to be removed.
	 * Cells that match the id are removed one at a time
	 * from the collection of spreatsheet cells.
	 *
	 * param {String} id the id of the cell to be removed
	 */
	SpreadSheet.prototype.removeCellById = function (id) {
		_.remove(this.cells, (cell)=> cell.id === id );
	};

	return {
		getSpreadSheet: function (cells) {
			return new SpreadSheet(cells);
		}
	};

})();

var spreadSheet = SpreadSheetFactory.getSpreadSheet();

function contrainValue(value, min, max) {
	min = min || 0;
	max = max || 10;
	value = _.isFinite(value) ? value : 1;
	value = Math.max(min, value);
	value = Math.min(max, value);
	return value;
}

/*
 * drawSpreadSheet
 *
 * param {int} width
 * param {int} height
 * return void
 */
function drawSpreadSheet(width, height) {
	var table = document.querySelector("table");
	width = contrainValue(width, 1, 27);
	height = contrainValue(height, 1, 20);

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

drawSpreadSheet(10, 10);

var INPUTS = $('.spreadsheet-cell'); //get all inputs
var cells = [];

function processPusherId(value, a, b) {
	var pusherId1 = a.pusher_id;
	var pusherId2 = b.pusher_id;
	var obj = {
		value: value
	};

	if (pusherId1 === 'self' || pusherId2 === 'self') {
		obj.pusher_id = 'self';
	} else if (pusherId1 === 'const' || _.isNull(pusherId2)) {
		obj.pusher_id = 'const';
	} else if (_.isNull(pusherId1) || pusherId2 === 'const') {
		obj.pusher_id = 'const';
	}

	return obj;
}

function processElements(socketUpdate, socketMessage) {
	function add(a, b) {
		return processPusherId(a.value + b.value, a, b);
	}

	function minus(a, b) {
		return processPusherId(a.value - b.value, a, b);
	}

	function multiply(a, b) {
		return processPusherId(a.value * b.value, a, b);
	}

	function divide(a, b) {
		var value;
		if (b.value === 0) {
			value = '#ERROR DIVISION BY ZERO ERROR';
		} else {
			value = a.value / b.value;
		}
		return processPusherId(value, a, b);
	}

	function power(a, b) {
		return processPusherId(Math.pow(a.value, b.value), a, b);
	}

	function fetchAndCombine(token, combiner, pushers) {
		var right = '';
		var left = calculate(token.left, pushers);

		if (token.right) {
			right = calculate(token.right, pushers);
		} else {
			right = createConstant(0);
		}
		return left.combine(right, combiner);
	}

	function createConstant(value) {
		return Bacon.constant({
			value: Number(value),
			pusher_id: "const"
		});
	}

	function calculate(token, pushers) {
		var left = 0;
		var right = 0;
		var value = 0;

		if (token.type === 'number') {
			value = createConstant(token.token);
		} else if (token.type === 'cellname') {
			value = spreadSheet.getCellById(token.token);
			pushers.push(value);
			value = value.bus;
		} else if (token.type === 'unary') {
			right = calculate(token.right, pushers);
			if (token.token === '+') {
				value = right;
			} else {
				left = createConstant(0);
				value = left.combine(right, minus);
			}
		} else if (token.type === "leftparen") {
			left = calculate(token.left, pushers);
			right = token.right;
			if (right.type === 'rightparen') {
				value = left;
			}
		} else if (token.type === 'operator') {

			switch (token.token) {
			case '+':
				value = fetchAndCombine(token, add, pushers);
				break;
			case '-':
				value = fetchAndCombine(token, minus, pushers);
				break;
			case '*':
				value = fetchAndCombine(token, multiply, pushers);
				break;
			case '/':
				value = fetchAndCombine(token, divide, pushers);
				break;
			case '^':
				value = fetchAndCombine(token, power, pushers);
				break;
			}
		}
		return value;
	}

	function updateCell(cell, element, value) {
		cell.value = value;
		if (element.is(':focus')) {
			element.val(cell.formula);
		} else {
			element.val(cell.value);
		}
		localStorage[cell.id] = cell.formula;
		log(cell, 'success');
		cell.pusher('self');
	}

	function log(cell, result, action) {
		action = action || 'update';
		socket.emit('log', {
			id: cell.id,
			formula: cell.formula,
			value: cell.value,
			user_id: userId,
			update: result,
			action: action
		});
	}

	INPUTS.each(function (index, elem) {
		var element = $(elem);
		var model = {
			element: element,
			id: element.attr('id')
		};
		var pushers = [];

		cells.push(model);

		socketUpdate.filter(function (data) {
				return data.element === model.id;
			})
			.onValue(function (data) {
				var cell = spreadSheet.getCellById(data.element);
				var value = data.formula.toUpperCase();
				var cellId = cell.id;

				if (data.timestamp > cell.lastUpdated) {
					pushers = [];
					cell.formula = value;
					if (cell.dispose) {
						cell.dispose();
					}
					cell.dispose = null;
					if (_.isUndefined(value) || value === '') {
						updateCell(cell, element, 0);
						cell.expanded = '0';
					} else {
						value = window.parser.parse(value.replace('=', ''), cell.id);
						if (_.isString(value) && /ERROR/ig.test(value)) {
							updateCell(cell, element, value);
						} else {
							cell.dispose = calculate(value, pushers)
								.onValue(function (result) {
									if (!_.isNumber(result)) {
										var pusherId = _.trim(result.pusher_id);
										if (/^(self|const)$/ig.test(pusherId) || pusherId === cellId) {
											updateCell(cell, element, result.value);
										}
									}
								});

							_(pushers)
								.uniqBy(function (aCell) {
									return aCell.id;
								})
								.forEach(function (aCell) {
									aCell.pusher(cellId);
								});
						}
					}
				} else {
					log(cell, 'rejected');
				}
			});

		element.asEventStream('focus')
			.onValue(function (event) {
				var elementid = event.target.id;
				var cell = spreadSheet.getCellById(elementid);
				var value = cell.formula;
				element.val(value);
			});

		element.asEventStream('blur')
			.map(function (event) {
				var elementid = event.target.id;
				var formula = event.target.value;

				return {
					element: elementid,
					formula: formula,
					user_id: userId
				};
			})
			.onValue(function (data) {
				socket.emit('write', data);
			});
	});

	spreadSheet.addCells(cells);
	window.parser.setSpreadSheet(spreadSheet);

	socketUpdate.onValue(function (data) {
		console.log('update:', data);
	});
}

var userId;
/* eslint-disable */
var socket = io.connect('http://localhost:5000');
/* eslint-enable */

socket.on('connect', function (data) {
	window.parser.setSocket(socket); //need it for logging

	socket.emit('join', 'Hello World from client');

	socket.on('userid', function (data) {
		userId = data;
	});

	var socketUpdate = Bacon.fromBinder(function (sink) {
		socket.on('update', function (data) {
			sink(data);
		});
	});

	processElements(socketUpdate);
});
