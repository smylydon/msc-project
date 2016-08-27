/* eslint-disable */
var _ = _;
var Bacon = Bacon;
/* eslint-enable */

/* eslint-disable */
var _ = _;
var Bacon = Bacon;
/* eslint-enable */

/*
 * CellFactory
 */
var CellFactory = (function () {
  function Cell(data) {
    this.id = data.id;
    this.element = data.element;
    this.value = 0;
    this.bus = new Bacon.Bus();
  }

  Cell.prototype.pusher = function () {
    this.bus.push(this.value);
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
   * param {Array}
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
   * Cell of objects are create using the json objects.
   * The cells are added to collection of spreatsheet
   * cells.
   *
   * param {Array} an array of json objects
   */
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
  width = contrainValue(width, 1, 27);
  height = contrainValue(height, 1, 20);

  var table = document.querySelector("table");

  for (var i = 0; i < height; i++) {
    var row = table.insertRow(-1);
    for (var j = 0; j < width; j++) {
      var letter = String.fromCharCode("A".charCodeAt(0) + j - 1);
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

function processElements(socketUpdate, socketMessage) {
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

  function fetchAndCombine(token, combiner, pushers) {
    var right = '';
    var left = calculate(token.left, pushers);

    if (token.right) {
      right = calculate(token.right, pushers);
    } else {
      right = Bacon.constant(0);
    }
    return left.combine(right, combiner);
  }

  function calculate(token, pushers) {
    var left = 0;
    var right = 0;
    var value = 0;

    if (token.type === 'number') {
      value = Bacon.constant(parseFloat(token.token));
    } else if (token.type === 'cellname') {
      value = spreadSheet.getCellById(token.token);
      pushers.push(value);
      value = value.bus;
    } else if (token.type === 'unary') {
      right = calculate(token.right, pushers);
      if (token.token === '+') {
        value = right;
      } else {
        left = Bacon.constant(0);
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
      }
    }
    return value;
  }

  function updateCell(cell, element, value) {
    cell.value = value;
    element.val(cell.value);
    //localStorage[cell.id] = cell.formula;
    cell.pusher();
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
    }).onValue(function (data) {
      var cell = spreadSheet.getCellById(data.element);
      var value = data.formula.toUpperCase();
      var test = true;
      pushers = [];
      cell.formula = value;
      //      console.log(':', cell.formula, cell.value);
      if (_.isUndefined(value) || value === '') {
        updateCell(cell, element, 0);
      } else {
        if (value.charAt(0) === "=") {
          value = value.substring(1);
        }
        value = window.parser(value);
        calculate(value, pushers).onValue(function (x) {
          console.log(':', cell.id, cell.formula, cell.value, test);
          updateCell(cell, element, x);
          test = false;
        });
        pushers.forEach(function (cell) {
          cell.pusher();
        });
      }
    });

    element.asEventStream('focus')
      .onValue(function (event) {
        var elementid = event.target.id;
        var cell = spreadSheet.getCellById(elementid);
        var value = cell.formula; // || localStorage[elementid] || "";
        console.log('cell:', cell);
        element.val(value);
      });

    element.asEventStream('blur')
      .map(function (event) {
        var elementid = event.target.id;
        var formula = event.target.value;
        //localStorage[elementid] = formula;

        return {
          element: elementid,
          formula: formula,
          user_id: userId
        };
      }).onValue(function (data) {
        socket.emit('write', data);
      });
  });

  spreadSheet.addCells(cells);
}

var userId;
/* eslint-disable */
var socket = io.connect('http://localhost:5000');
/* eslint-enable */

socket.on('connect', function (data) {
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
