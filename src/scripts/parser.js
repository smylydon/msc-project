var parser = (function parse() {
  var functionRegex = /(sum|avg|mean)\(\s*[a-z]\d+\s*:\s*[a-z]\d+\s*\)/i;
  var cellRegex = /[A-Z]\d+/i;
  var operatorRegex = /[+\-\/\*]/;
  var numberRegex = /\d+(\.\d+)?/;
  var position = 0;

  function tokenize(value) {
    var results = [];
    var tokenRegEx =
      /([A-Z]\d+|\d+(\.\d+)?|[+\-\/\*]|\(|\)|(sum|avg|mean)\(\s*[a-z]\d+\s*:\s*[a-z]\d+\s*\))/ig;

    var m;
    while ((m = tokenRegEx.exec(value)) !== null) {
      results.push(parseToken(m[0])); //parseToken
    }
    return results;
  }

  function createToken(value, type) {
    return {
      token: value,
      type: type
    };
  }

  function parsePrimary(value) {
    var result = {};
    value = value.trim();
    if (operatorRegex.test(value)) {
      result = createToken(value, 'operator');
    } else if (numberRegex.test(value)) {
      result = createToken(value, 'number');
    } else if (/\(/.test(value)) {
      result = createToken(value, 'leftparen');
    } else if (/\)/.test(value)) {
      result = createToken(value, 'rightparen');
    } else if (cellRegex.test(value)) {
      result = createToken(value, 'cellname');
    } else if (functionRegex.test(value)) {
      var name = '';
      if (/sum/ig.test(value)) {
        name = 'sum';
      } else if (/(avg|mean)/ig.test(value) / ) {
        name = "mean";
      }
      result = createToken(value, name);
    } else {
      result = createToken(value, '');
    }
    return result;
  }

  function peek() {
    return result[position];
  }

  function next() {
    var value = peek();
    position++;
    return value;
  }

  function parseMultiplicative() {
    var expression = parsePrimary();
    var token = peek();

    while (token === '*' || token === '/') {
      token = next();
      expression = {
        type: token,
        left: expression,
        right: parsePrimary()
      }
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
        type: token,
        left: expression,
        right: parseMultiplicative()
      }
      token = peek();
    }
    return expression;
  }

  function parse(value) {
    position = 0;
    result = tokenize(value);
  }

  return parse;
})();
