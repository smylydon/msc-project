/* eslint-disable */
var _ = _;
var Bacon = Bacon;
/* eslint-enable */

var Cell = function (cell) {
  this.id = cell.id;
  this.element = cell.element;
  this.bus = new Bacon.Bus();
};

var SpreadSheetFactory = (function () {
  function SpreadSheet(cells) {
    this.bus = new Bacon.Bus();
    this.cells = [];
    this.addCells(cells);
  }

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

var DATA = {};

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

    socketUpdate.filter(function (data) {
      return data.element === model.id;
    }).onValue(function (data) {
      var value = data.formula;
      console.log('socketUpdate:', data);

      if (value.charAt(0) === "=") {
        model.formula = value;
        model.value = window.parser(value.substring(1));
        //total = calculate(value);
        //DATA
        //return total;
      } else {
        value = isNaN(parseFloat(value)) ? value : parseFloat(value);
        model.value = value;
        model.formula = value;
      }
      element.val(model.value);
      localStorage[model.id] = model.formula;
      console.log('cell is:', model);
    });

    element.asEventStream('focus')
      .onValue(function (event) {
        var elementid = event.target.id;
        var value = localStorage[elementid] || "";
        element.val(value);
        console.log('focusStream');
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
}

var userId;
/* eslint-disable */
var socket = io.connect('http://localhost:5000');
/* eslint-enable */

socket.on('connect', function (data) {
  socket.emit('join', 'Hello World from client');

  socket.on('userid', function (data) {
    userId = data;

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

    spreadSheet.addCells(cells);

    processElements(socketUpdate, socketMessage);
  });
});
