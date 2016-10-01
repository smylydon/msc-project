window.parser = (function () {
	var functionRegex = /(sum|avg|mean)\(\s*[a-z]([1-9]\d+|[1-9])\s*:\s*[a-z]([1-9]\d+|[1-9])\s*\)/ig;
	var cellRegex = /^[A-Z]([1-9]\d+|[1-9])$/i;
	var cellRegex2 = /[A-Z]([1-9]\d+|[1-9])/ig;
	var operatorRegex = /[+\-\/\*\^]/;
	var numberRegex = /^\d+(\.\d+)?$/;
	var position = 0;
	var tokens = [];
	var tokenRegEx = /([A-Z]([1-9]\d+|[1-9])|\d+(\.\d+)?|[+\-\/\*\^]|\(|\))/ig;

	function tokenize(value) {
		var results = [];
		var m;

		while ((m = tokenRegEx.exec(value)) !== null) {
			results.push(m[0]); //save token
		}
		return results;
	}

	function peek() {
		return tokens[position];
	}

	function next() {
		var value = peek();
		position++;
		return value;
	}

	function createToken(value, type) {
		position++;
		return {
			token: value,
			type: type
		};
	}

	function parsePrimary() {
		var result = {};
		var value = peek();

		if (operatorRegex.test(value)) {
			result = createToken(value, 'unary');
			result.right = parseAdditive();
		} else if (numberRegex.test(value)) {
			result = createToken(value, 'number');
		} else if (/^\($/.test(value)) {
			result = createToken(value, 'leftparen');
			result.left = parseAdditive();
			value = peek();
			if (value === ')') {
				result.right = createToken(value, 'rightparen');
			}
		} else if (cellRegex.test(value)) {
			result = createToken(value, 'cellname');
		} else {
			result = createToken(value, '');
		}

		return result;
	}

	function processOperator(condition, expressionCallback) {
		var expression = expressionCallback();
		var token = peek();

		while (condition(token)) {
			token = next();
			expression = {
				token: token,
				type: 'operator',
				left: expression,
				right: expressionCallback()
			};
			token = peek();
		}
		return expression;
	}

	function parseMultiplicative() {
		return processOperator(function (token) {
			return token === '*' || token === '/' || token === '^';
		}, parsePrimary);
	}

	function parseAdditive() {
		return processOperator(function (token) {
			return token === '+' || token === '-';
		}, parseMultiplicative);
	}

	function nextChar(c) {
		return String.fromCharCode(c.charCodeAt(0) + 1);
	}

	function cleanupSumMean(string, fname, counter) {
		string = string.replace(/^\+/, '');
		string = '(' + string + ')';
		if (fname === 'mean') {
			string = '(' + string + '/' + counter + ')';
		}
		return string;
	}

	/*
	 * expandSumAndMean
	 *
	 * This function expands sum and mean into a longform
	 * equivalent. Example:
	 *
	 * mean(a1:a5) => (a1+a2+a3+a4+a5)/5
	 *
	 * param {String} text rep of function
	 */
	function expandSumAndMean(value) {
		var startLetter = '';
		var endLetter = '';
		var startNum = '';
		var endNum = '';
		var cells;
		var counter = 0;
		var string = '#ERROR';
		var fname = /sum/i.test(value) ? 'sum' : 'mean';
		var createSeries = function (clause, increment) {
			string = '';
			while (clause()) {
				string += '+' + startLetter + startNum;
				increment();
				counter++;
			}
			string = cleanupSumMean(string, fname, counter);
		};

		value = value.replace(/(sum|avg|mean|[\(\)]+)/ig, '')
			.replace(' ', '');
		cells = value.split(':');
		startLetter = cells[0][0];
		endLetter = cells[1][0];
		startNum = parseInt(cells[0][1]);
		endNum = parseInt(cells[1][1]);

		if (startLetter === endLetter) {
			if (endNum >= startNum) {
				createSeries(function () {
					return startNum <= endNum;
				}, function () {
					startNum++;
				});
			}
		} else if (endLetter >= startLetter) {
			if (endNum === startNum) {
				createSeries(function () {
					return startLetter <= endLetter;
				}, function () {
					startLetter = nextChar(startLetter);
				});
			}
		}
		console.log('>>>', string);
		return string;
	}

	var socket;
	var spreadSheet;

	function setSpreadSheet(newSpreadSheet) {
		spreadSheet = newSpreadSheet || spreadSheet;
	}

	function setSocket(newSocket) {
		socket = newSocket || socket;
	}

	function init(spreadSheet, socket) {
		setSpreadSheet(spreadSheet);
		setSocket(socket);
	}

	/*
	 * expandCells
	 *
	 * Recursively removes transitive relationships. If this is not done
	 * it results in glitches.
	 *
	 * Example:
	 * A1 = 1
	 * B1 = A1+1
	 * C1 = B1 + A1
	 *   -> A1 + 1 + A1
	 *
	 * Added code to check for circular dependencies.
	 *
	 * param {String} user input
	 */
	function expandCells(visitedCells, label) {
		var cell = spreadSheet.getCellById(label);
		var formula = cell.formula;

		if (cellRegex2.test(formula)) {
			if (visitedCells.indexOf(label) < 0) {
				var visited = [cell.id];
				Array.prototype.push.apply(visited, visitedCells);
				label = formula.replace(cellRegex2, curry(expandCells, visited));
			} else {
				console.log('#ERROR CYCULAR DEPENDENCY', label, visitedCells);
				label = '#ERROR CYCULAR DEPENDENCY';
			}
		}

		//if there is more than one term in label
		//use brackets to preserve arithmatic order
		var match = label.match(tokenRegEx);
		label = match && match.length > 1 ? '(' + label + ')' : label;

		return label;
	}

	function curry() {
		var args = Array.prototype.slice.call(arguments),
			fn = args.shift();
		return function () {
			return fn.apply(fn, args.concat(Array.prototype.slice.call(arguments)));
		};
	}

	function parse(value, label) {
		value = value || '';
		position = 0;
		value = value.replace(functionRegex, expandSumAndMean);
		value = value.replace(cellRegex2, curry(expandCells, [label]));

		if (/ERROR/ig.test(value)) {
			if (/CIRCULAR/ig.test(value)) {
				value = '#ERROR CYCULAR DEPENDENCY';
			} else {
				value = '#ERROR';
			}
		} else {
			console.log('tokenize:', value);
			tokens = tokenize(value);
			value = parseAdditive();
		}
		return value;
	}

	return {
		init: init,
		parse: parse,
		setSocket: setSocket,
		setSpreadSheet: setSpreadSheet
	};
})();
