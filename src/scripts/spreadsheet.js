/* eslint-disable */
var _ = _;
var Bacon = Bacon;
/* eslint-enable */

var Cell = function (cell) {
  this.id = cell.id;
  this.element = cell.element;
  this.value = 0;
  this.bus = new Bacon.Bus();

  this.pusher = () => {
    console.log('pushing:', this.value);
    this.bus.push(this.value);
  };

  this.bus.onValue(function (value) {
    console.log('value:', value);
  });
  this.pusher();
};

var SpreadSheetFactory = (function () {
  function SpreadSheet(cells) {
    this.cells = [];
    this.addCells(cells);
  }

  SpreadSheet.prototype.getCellById = function (id) {
    return _.find(this.cells, {
      id: id
    });
  };

  SpreadSheet.prototype.addCells = function (cells) {
    cells = _.isArray(cells) ? cells : [];
    cells = cells.map(function (cell) {
      return new Cell(cell);
    });
    Array.prototype.push.apply(this.cells, cells);
  };

  SpreadSheet.prototype.addCell = function (cell) {
    this.cells.push(new Cell(cell));
  };

  SpreadSheet.prototype.removeCellsById = function (ids) {
    ids = _.isArray(ids) ? ids : [];
    _.forEach(ids, function (id) {
      _.remove(this.cells, function (cell) {
        return cell.id === id;
      });
    });
  };

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

var spreadSheet = SpreadSheetFactory.getSpreadSheet();

for (var i = 0; i < 6; i++) {
  var row = document.querySelector("table")
    .insertRow(-1);
  for (var j = 0; j < 6; j++) {
    var letter = String.fromCharCode("A".charCodeAt(0) + j - 1);
    row.insertCell(-1)
      .innerHTML = i && j ? "<input id='" + letter + i + "'/>" :
      i || letter;
  }
}

//var DATA = {};

var INPUTS = $('input'); //get all inputs
var cells = [];

function processElements(socketUpdate, socketMessage) {
  INPUTS.each(function (index, elem) {
    var element = $(elem);
    var model = {
      element: element,
      id: element.attr('id')
    };

    cells.push(model);

    function updateCell(cell, element, value) {
      cell.value = value;
      element.val(cell.value);
      localStorage[cell.id] = cell.formula;
      cell.pusher();
    }

    socketUpdate.filter(function (data) {
      return data.element === model.id;
    }).onValue(function (data) {
      var cell = spreadSheet.getCellById(data.element);
      var value = data.formula.toUpperCase();
      cell.formula = value;

      if (value.charAt(0) === "=") {
        value = window.parser(value.substring(1));
        var total = calculate(value);
        total.onValue(function (x) {
          console.log('go update cell:', x);
          updateCell(cell, element, x);
        });
      } else {
        value = isNaN(parseFloat(value)) ? value : parseFloat(value);
        updateCell(cell, element, value);
      }

    });

    element.asEventStream('focus')
      .onValue(function (event) {
        var elementid = event.target.id;
        var value = localStorage[elementid] || "";
        element.val(value);
      });

    element.asEventStream('blur')
      .map(function (event) {
        var elementid = event.target.id;
        var formula = event.target.value;
        localStorage[elementid] = formula;
        console.log('blurStream');
        return {
          element: elementid,
          formula: formula,
          user_id: userId
        };
      }).onValue(function (data) {
        socket.emit('write', data);
      });

    function add(a, b) {
      return a + b;
    }

    function minus(a, b) {
      return a - b;
    }

    function multiply(a, b) {
      return a * b;
    }

    function divide(a, b) {
      if (b === 0) {
        return 0;
      }
      return a / b;
    }
    /*
        function makeProperty(num, min) {
          min = min || 0;
          return new Bacon.fromBinder(function (sink) {
            sink(num);
          }).toProperty(min);
        }*/

    function fetchAndCombine(token, combiner) {
      var right = '';
      var left = calculate(token.left);
      if (token.right) {
        right = calculate(token.right);
      } else {
        right = Bacon.constant(0);
      }
      return left.combine(right, combiner);
    }

    function calculate(token) {
      var left = 0;
      var right = 0;
      var value = 0;
      var cell = 0;
      console.log('calculate:', token.type);
      if (token.type === 'number') {
        value = Bacon.constant(parseFloat(token.token));
      } else if (token.type === 'cellname') {
        cell = spreadSheet.getCellById(token.token);
        value = cell.bus;
        cell.pusher();
        console.log('got cell:', value);
      } else if (token.type === 'unary') {
        right = calculate(token.right);
        if (token.token === '+') {
          value = right;
        } else {
          left = Bacon.constant(0);
          value = left.combine(right, minus);
        }
      } else if (token.type === "leftparen") {
        left = calculate(token.left);
        right = token.right;
        if (right.type === 'rightparen') {
          value = left;
        }
      } else if (token.type === 'operator') {

        switch (token.token) {
          case '+':
            value = fetchAndCombine(token, add);
            break;
          case '-':
            value = fetchAndCombine(token, minus);
            break;
          case '*':
            value = fetchAndCombine(token, multiply);
            break;
          case '/':
            value = fetchAndCombine(token, divide);
            break;
        }
      }
      return value;
    }
    /* eslint-disable */
    function getter() {
      var value = localStorage[element.attr('id')] || "";
      var total = 0;
      if (value.charAt(0) === "=") {
        value = window.parser(value.substring(1));
        total = calculate(value);
        //DATA
        return total;
      } else {
        return isNaN(parseFloat(value)) ? value : parseFloat(value);
      }
    }
    /* eslint-enable */

  });

  spreadSheet.addCells(cells);
}

var userId;
/* eslint-disable */
var socket = io.connect('http://localhost:5000');
/* eslint-enable */

socket.on('connect', function (data) {
  console.log('connect');
  socket.emit('join', 'Hello World from client');

  socket.on('userid', function (data) {
    userId = data;
  });

  var socketUpdate = Bacon.fromBinder(function (sink) {
    socket.on('update', function (data) {
      sink(data);
    });
  });

  var socketMessage = Bacon.fromBinder(function (sink) {
    socket.on('messages', function (data) {
      sink(data);
    });
  });

  processElements(socketUpdate, socketMessage);
});
