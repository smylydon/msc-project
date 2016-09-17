window.parser = (function () {
	var functionRegex = /(sum|avg|mean)\(\s*[a-z]([1-9]\d+|[1-9])\s*:\s*[a-z]([1-9]\d+|[1-9])\s*\)/ig;
	var cellRegex = /^[A-Z]([1-9]\d+|[1-9])$/i;
	var cellRegex2 = /[A-Z]([1-9]\d+|[1-9])/ig;
	var operatorRegex = /[+\-\/\*]/;
	var numberRegex = /^\d+(\.\d+)?$/;
	var position = 0;
	var tokens = [];

	function tokenize(value) {
		var results = [];
		var tokenRegEx = /([A-Z]([1-9]\d+|[1-9])|\d+(\.\d+)?|[+\-\/\*]|\(|\))/ig;

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

	function parseMultiplicative() {
		var expression = parsePrimary();
		var token = peek();

		while (token === '*' || token === '/') {
			token = next();
			expression = {
				token: token,
				type: 'operator',
				left: expression,
				right: parsePrimary()
			};
			token = peek();
		}
		return expression;
	}

	function parseAdditive() {
		var expression = parseMultiplicative();
		var token = peek();

		while (token === '+' || token === '-') {
			token = next();
			expression = {
				token: token,
				type: 'operator',
				left: expression,
				right: parseMultiplicative()
			};
			token = peek();
		}
		return expression;
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

		value = value.replace(/(sum|avg|mean|[\(\)]+)/ig, '')
			.replace(' ', '');
		cells = value.split(':');
		startLetter = cells[0][0];
		endLetter = cells[1][0];
		startNum = parseInt(cells[0][1]);
		endNum = parseInt(cells[1][1]);

		if (startLetter === endLetter) {
			if (endNum >= startNum) {
				string = '';
				while (startNum <= endNum) {
					string += '+' + startLetter + startNum;
					startNum++;
					counter++;
				}
				string = cleanupSumMean(string, fname, counter);
			}
		} else if (endLetter >= startLetter) {
			if (endNum === startNum) {
				string = '';
				while (startLetter <= endLetter) {
					string += '+' + startLetter + startNum;
					startLetter = nextChar(startLetter);
					counter++;
				}
				string = cleanupSumMean(string, fname, counter);
			}
		}
		console.log('>>>', string);
		return string;
	}

	var spreadSheet;

	function setSpreadSheet(collection) {
		spreadSheet = collection;
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
	 * param {String} user input
	 */
	function expandCells(label) {
		var cell = spreadSheet.getCellById(label);
		var formula = cell.formula;
		if (cellRegex2.test(formula)) {
			label = formula.replace(cellRegex2, expandCells);
		}
		return label;
	}

	function parse(value) {
		value = value || '';
		position = 0;
		value = value.replace(functionRegex, expandSumAndMean);
		value = value.replace(cellRegex2, expandCells);
		tokens = tokenize(value);
		return parseAdditive();
	}

	return {
		parse: parse,
		setSpreadSheet: setSpreadSheet
	};
})();
