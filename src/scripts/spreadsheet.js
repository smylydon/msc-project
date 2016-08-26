/* eslint-disable */
var _ = _;
var Bacon = Bacon;
/* eslint-enable */

var CellFactory = (function () {
  function Cell(data) {
    this.id = data.id;
    this.element = data.element;
    this.value = 0;
    this.bus = new Bacon.Bus();
  }

  Cell.prototype.pusher = function () {
    console.log('pushing:', this.id, this.value);
    this.bus.push(this.value);
  };
  return {
    getNewCell: function (data) {
      return new Cell(data);
    }
  };
})();

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
    cells = cells.map(function (data) {
      return CellFactory.getNewCell(data);
    });
    Array.prototype.push.apply(this.cells, cells);
  };

  SpreadSheet.prototype.addCell = function (data) {
    this.cells.push(CellFactory.getNewCell(data));
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

function drawSpreadSheet(width, height) {
  width = width || 1;
  height = height || 1;

  var table = document.querySelector("table");

  for (var i = 0; i < height; i++) {
    var row = table.insertRow(-1);
    for (var j = 0; j < width; j++) {
      var letter = String.fromCharCode("A".charCodeAt(0) + j - 1);
      row.insertCell(-1)
        .innerHTML = i && j ? "<input id='" + letter + i + "'/>" :
        i || letter;
    }
  }
}

drawSpreadSheet(10, 10);

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
        console.log('do onValue');
        total.onValue(function (x) {
          console.log('do updateCell:', cell.id, x);
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
