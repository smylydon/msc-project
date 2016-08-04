for (var i = 0; i < 6; i++) {
  var row = document.querySelector("table").insertRow(-1);
  for (var j = 0; j < 6; j++) {
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

  function getter() {
    var value = localStorage[element.id] || "";
    if (value.charAt(0) === "=") {
      console.log('DATA:', tokenize(value.substring(1)));
      //DATA
      //return DATA.eval( value.substring( 1 ) );
      return 0;
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
