window.parser = (function () {
	var functionRegex = /(sum|avg|mean)\(\s*[a-z]([1-9]\d+|[1-9])\s*:\s*[a-z]([1-9]\d+|[1-9])\s*\)/ig;
	var cellRegex = /^[A-Z]([1-9]\d+|[1-9])$/i;
	var cellRegex2 = /[A-Z]([1-9]\d+|[1-9])/ig;
	var operatorRegex = /[+\-\/\*\^]/;
	var numberRegex = /^\d+(\.\d+)?$/;
	var tokens = [];
	var tokenRegEx = /([A-Z]([1-9]\d+|[1-9])|\d+(\.\d+)?|[+\-\/\*\^]|\(|\))/ig;

	/*
	 * @function tokenize
	 * @description
	 * Uses the tokenRegEx to scan for valid input such as A1 or -100.20.
	 *
	 * @param {String} text rep of function
	 * @returns {Array} array of tokens
	 */
	function tokenize(value) {
		var results = [];
		var m;

		while ((m = tokenRegEx.exec(value)) !== null) {
			results.push(m[0]); //save token
		}
		return results;
	}

	/*
	 * @function peek
	 * @description
	 * Returns the token at the head of the list.
	 *
	 * @returns {String} token
	 */
	function peek() {
		return tokens[0];
	}

	/*
	 * @function next
	 * @description
	 * Pulls the token at the head of the list.
	 *
	 * @returns {String} token
	 */
	function next() {
		return tokens.shift();
	}

	/*
	 * @function createToken
	 * @description
	 * Pulls the token at the head of the list.
	 *
	 * @param {String} token
	 * @param {String} token type
	 * @returns {Object} token object
	 */
	function createToken(value, type) {
		next();
		return {
			token: value,
			type: type
		};
	}

	/*
	 * @function parsePrimary
	 * @description
	 * Pulls the token at the head of the list.
	 *
	 * @returns {Object} token object
	 */
	function parsePrimary() {
		var result = {};
		var value = peek();

		if (operatorRegex.test(value)) {
			result = createToken(value, 'unary');
			result.right = parseAdditionSubtraction();
		} else if (numberRegex.test(value)) {
			result = createToken(value, 'number');
		} else if (/^\($/.test(value)) {
			result = createToken(value, 'leftparen');
			result.left = parseAdditionSubtraction();
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

	/*
	 * @function processOperator
	 * @description
	 * Pulls the token at the head of the list.
	 *
	 * @param {Function} condition check
	 * @param {Function} operation with higher precedence
	 * @returns {Object} token object
	 */
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

	/*
	 * @function parseExponent
	 * @description
	 * Process exponents
	 *
	 * @returns {Object} token object
	 */
	function parseExponents() {
		return processOperator(function (token) {
			return token === '^';
		}, parsePrimary);
	}

	/*
	 * @function parseMultiplicationDivision
	 * @description
	 * Process multiplication and division.
	 *
	 * @returns {Object} token object
	 */
	function parseMultiplicationDivision() {
		return processOperator(function (token) {
			return token === '*' || token === '/';
		}, parseExponents);
	}

	/*
	 * @function parseAdditionSubtraction
	 * @description
	 * Process addition or subtraction
	 *
	 * @returns {Object} token object
	 */
	function parseAdditionSubtraction() {
		return processOperator(function (token) {
			return token === '+' || token === '-';
		}, parseMultiplicationDivision);
	}

	function nextChar(c) {
		return String.fromCharCode(c.charCodeAt(0) + 1);
	}


	function createSumMean(direction, setter) {
		var startLetter = setter.startLetter;
		var endLetter = setter.endLetter;
		var startNum = setter.startNum;
		var endNum = setter.endNum;
		var string = '';
		var counter = 0;
		var clause = direction === 'v' ? verticalClause : horizontalClause;
		var increment = direction === 'v' ? verticalIncrement : horizontalIncrement;

		function verticalClause() {
			return startNum <= endNum;
		}

		function verticalIncrement() {
			startNum++;
		}

		function horizontalClause() {
			return startLetter <= endLetter;
		}

		function horizontalIncrement() {
			startLetter = nextChar(startLetter);
		}

		while (clause()) {
			string += '+' + startLetter + startNum;
			increment();
			counter++;
		}
		string = string.replace(/^\+/, '');
		string = '(' + string + ')';
		string = setter.fname === 'mean' ? '(' + string + '/' + counter + ')' : string;
		return string;
	}

	/*
	 * @function expandSumAndMean
	 * @description
	 * This function expands sum and mean into a longform
	 * equivalent. Example:
	 *
	 * mean(a1:a5) => (a1+a2+a3+a4+a5)/5
	 *
	 * @param {String} text rep of function
	 */
	function expandSumAndMean(value) {
		var cells = value.replace(/(sum|avg|mean|[\(\)]+)/ig, '')
			.replace(' ', '')
			.split(':');
		var string = '#ERROR';

		var setter = {
			startLetter: cells[0][0],
			endLetter: cells[1][0],
			startNum: parseInt(cells[0][1]),
			endNum: parseInt(cells[1][1]),
			fname: /sum/i.test(value) ? 'sum' : 'mean'
		};

		if (setter.startLetter === setter.endLetter) {
			if (setter.endNum > setter.startNum) {
				string = createSumMean('v', setter);
			}
		} else if (setter.endLetter > setter.startLetter) {
			if (setter.endNum === setter.startNum) {
				string = createSumMean('h', setter);
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
	 * @function expandCells
	 * @description
	 * Recursively removes transitive relationships.
	 * Also checks for circular references.
	 *
	 * Example:
	 * A1 = 1
	 * B1 = A1+1
	 * C1 = B1 + A1
	 *   -> A1 + 1 + A1
	 *
	 * Added code to check for circular dependencies.
	 *
	 * @param {String} user input
	 */
	function expandCells(visitedCells, label) {
		var cell = spreadSheet.getCellById(label);
		var formula = cell.formula;

		if (cellRegex2.test(formula)) {
			if (visitedCells.indexOf(label) < 0) {
				var visited = [cell.id];
				Array.prototype.push.apply(visited, visitedCells);
				label = formula.replace(cellRegex2, expandCells.bind(this, visited));
			} else {
				console.log('#ERROR CIRCULAR DEPENDENCY', label, visitedCells);
				label = '#ERROR CIRCULAR DEPENDENCY';
			}
		}

		//if there is more than one term in label
		//use brackets to preserve arithmetic order
		var match = label.match(tokenRegEx);
		label = match && match.length > 1 ? '(' + label + ')' : label;

		return label;
	}

	/*
	 * @function parse
	 * @description
	 * Process user input.
	 *
	 * @returns {String} user input
	 * @params {String} cell id
	 * @returns {String} parsed user input
	 */
	function parse(value, label) {
		value = value || '';
		value = value.replace(functionRegex, expandSumAndMean);
		var circular = value.replace(cellRegex2, expandCells.bind(this, [label]));

		if (/ERROR/ig.test(circular)) {
			if (/CIRCULAR/ig.test(circular)) {
				value = '#ERROR CIRCULAR DEPENDENCY';
			} else {
				value = '#ERROR';
			}
		} else {
			console.log('tokenize:', value);
			tokens = tokenize(value);
			value = parseAdditionSubtraction();
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
