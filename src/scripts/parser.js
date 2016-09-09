window.parser = (function () {
	var functionRegex = /(sum|avg|mean)\(\s*[a-z]\d+\s*:\s*[a-z]\d+\s*\)/ig;
	var cellRegex = /^[A-Z]\d+$/i;
	var operatorRegex = /[+\-\/\*]/;
	var numberRegex = /^\d+(\.\d+)?$/;
	var position = 0;
	var tokens = [];

	function tokenize(value) {
		var results = [];
		var tokenRegEx =
			/([A-Z]\d+|\d+(\.\d+)?|[+\-\/\*]|\(|\)|(sum|avg|mean)\(\s*[a-z]\d+\s*:\s*[a-z]\d+\s*\))/ig;

		var m;
		while ((m = tokenRegEx.exec(value)) !== null) {
			results.push(m[0]); //save token
		}
		return results;
	}

	function peek() {
		var value = tokens[position];
		return value;
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

	function cleanupSumMean(string, fname, counter) {
		string = string.replace(/^\+/, '');
		string = '(' + string + ')';
		if (fname === 'mean') {
			string = '(' + string + '/' + counter + ')';
		}
		return string;
	}
	
	/*
   * sumMean
   *
   * This function expands sum and mean into a longform
	 * equivalent. Example:
	 *
	 * mean(a1:a5) => (a1+a2+a3+a4+a5)/5
   *
   * param {String} text rep of function
   */
	function sumMean(value) {
		var startLetter = '';
		var endLetter = '';
		var startNum = '';
		var endNum = '';
		var cells;
		var counter = 0;
		var string = '#ERROR';
		var fname = /sum/i.test(value) ? 'sum': 'mean';

		value = value.replace(/(sum|mean|[\(\)]+)/ig,'').replace(' ','');
		cells = value.split(':');
		startLetter = cells[0][0];
		endLetter = cells[1][0];

		if (startLetter === endLetter) {
			startNum = parseInt(cells[0][1]);
			endNum = parseInt(cells[1][1]);
			if (endNum >= startNum) {
				string = '';
				counter = startNum;
				while(startNum <= endNum) {
					string += '+' + startLetter + startNum;
					startNum++;
					counter++;
				}
				string = cleanupSumMean(string, fname, counter);
			}
		} else if (endLetter >= startLetter) {
			startNum = cells[0][1];
			endNum = cells[1][1];
			if (endNum === startNum) {
				string = '';
				while(startLetter <= endLetter) {
					string += '+' + startLetter + startNum;
					startLetter++;
					counter++;
				}
				string = cleanupSumMean(string, fname, counter);
			}
		}
		console.log('>>>',string);
		return string;
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
		}
		/*
		else if (functionRegex.test(value)) {
			var name = '';
			if (/sum/ig.test(value)) {
				name = 'sum';
			} else if (/^(avg|mean)/ig.test(value)) {
				name = "mean";
			}

			sumMean(name,value);
			result = createToken(value, name);
		} */
		else {
			result = createToken(value, '');
		}
		//console.log('valuing:', value, result);
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

	function parse(value) {
		position = 0;
		value = value.replace(functionRegex, sumMean); //expand functions
		tokens = tokenize(value);
		return parseAdditive();
	}

	return parse;
})();
