for (var i = 0; i < 4; i++) {
  var row = document.querySelector("table").insertRow(-1);
  for (var j = 0; j < 4; j++) {
    var letter = String.fromCharCode("A".charCodeAt(0) + j - 1);
    row.insertCell(-1).innerHTML = i && j ? "<input id='" + letter + i + "'/>" :
      i || letter;
  }
}

var DATA = {};
var INPUTS = [].slice.call(document.querySelectorAll("input"));

INPUTS.forEach(function (element) {

  element.onfocus = function (event) {
    event.target.value = localStorage[event.target.id] || "";
  };

  element.onblur = function (event) {
    localStorage[event.target.id] = event.target.value;
    window.computeAll();
  };

  function calculate(token) {
    var left = 0;
    var right = 0;
    var value = 0;

    if (token.type === 'number') {
      value = parseFloat(token.token);
    } else if (token.type === 'cellname') {
      value = DATA[token.token];
    } else if (token.type === 'unary') {
      right = calculate(token.right);
      value = token.token === '+' ? right : 0 - right;
    } else if (token.type === "leftparen") {
      left = calculate(token.left);
      right = token.right;
      if (right.type === 'rightparen') {
        value = left;
      }
    } else if (token.type === 'operator') {
      switch (token.token) {
        case '+':
        case '-':
          left = calculate(token.left);
          right = token.right ? calculate(token.right) : 0;
          value = token.token === '+' ? (left + right) : (left - right);
          break;
        case '*':
        case '/':
          left = calculate(token.left);
          right = token.right ? calculate(token.right) : 1;
          value = token.token === '*' ? (left * right) : (left / right);
          break;
      }
    }
    return value;
  }

  function getter() {
    var value = localStorage[element.id] || "";
    var total = 0;
    if (value.charAt(0) === "=") {
      value = window.parser(value.substring(1));
      total = calculate(value);
      //console.log('DATA:', value, total);
      //DATA
      return total;
    } else {
      return isNaN(parseFloat(value)) ? value : parseFloat(value);
    }
  }

  Object.defineProperty(DATA, element.id, {
    get: getter
  });

  Object.defineProperty(DATA, element.id.toLowerCase(), {
    get: getter
  });

});

window.computeAll = (function () {
  return function () {
    INPUTS.forEach(function (element) {
      try {
        element.value = DATA[element.id];
      } catch (exception) {
        //console.warn('Exception:', exception);
      }
    });
  };
})();
