"use strict";function processElements(e,t){INPUTS.each(function(t,n){function o(e,t,n){e.value=n,t.val(e.value),localStorage[e.id]=e.formula}function r(e,t){return e+t}function l(e,t){return e-t}function i(e,t){return e*t}function a(e,t){return 0===t?0:e/t}function c(e,t){return t=t||0,new Bacon.fromBinder(function(t){t(e)}).toProperty(t)}function s(e,t){var n="",o=u(e.left);return n=e.right?u(e.right):c(0),o.combine(n,t)}function u(e){var t=0,n=0,o=0;if(console.log("calculate:",e.type),"number"===e.type)o=c(parseFloat(e.token));else if("cellname"===e.type)o=spreadSheet.getCellById(e.token).bus,console.log("got cell:",o);else if("unary"===e.type)n=u(e.right),"+"===e.token?o=n:(t=c(0),o=t.combine(n,l));else if("leftparen"===e.type)t=u(e.left),n=e.right,"rightparen"===n.type&&(o=t);else if("operator"===e.type)switch(e.token){case"+":o=s(e,r);break;case"-":o=s(e,l);break;case"*":o=s(e,i);break;case"/":o=s(e,a)}return o}var f=$(n),d={element:f,id:f.attr("id")};cells.push(d),e.filter(function(e){return e.element===d.id}).onValue(function(e){var t=spreadSheet.getCellById(e.element),n=e.formula;if(t.formula=n,console.log(" cell is:",n),"="===n.charAt(0)){n=window.parser(n.substring(1));var r=u(n);console.log("made it"),r.onValue(function(e){o(t,f,e)})}else n=isNaN(parseFloat(n))?n:parseFloat(n),o(t,f,n)}),f.asEventStream("focus").onValue(function(e){var t=e.target.id,n=localStorage[t]||"";f.val(n)}),f.asEventStream("blur").map(function(e){var t=e.target.id,n=e.target.value;return localStorage[t]=n,console.log("blurStream"),{element:t,formula:n,user_id:userId}}).onValue(function(e){socket.emit("write",e)})}),spreadSheet.addCells(cells)}for(var _=_,Bacon=Bacon,Cell=function(e){this.id=e.id,this.element=e.element,this.value=55;var t=this;this.bus=new Bacon.fromBinder(function(e){e(t.value)})},SpreadSheetFactory=function(){function e(e){this.cells=[],this.addCells(e)}return e.prototype.getCellById=function(e){return _.find(this.cells,{id:e})},e.prototype.addCells=function(e){e=_.isArray(e)?e:[],e=e.map(function(e){return new Cell(e)}),Array.prototype.push.apply(this.cells,e)},e.prototype.addCell=function(e){this.cells.push(new Cell(e))},e.prototype.removeCellsById=function(e){e=_.isArray(e)?e:[],_.forEach(e,function(e){_.remove(this.cells,function(t){return t.id===e})})},e.prototype.removeCellById=function(e){_.remove(this.cells,function(t){return t.id===e})},{getSpreadSheet:function(t){return new e(t)}}}(),spreadSheet=SpreadSheetFactory.getSpreadSheet(),i=0;i<6;i++)for(var row=document.querySelector("table").insertRow(-1),j=0;j<6;j++){var letter=String.fromCharCode("A".charCodeAt(0)+j-1);row.insertCell(-1).innerHTML=i&&j?"<input id='"+letter+i+"'/>":i||letter}var INPUTS=$("input"),cells=[],userId,socket=io.connect("http://localhost:5000");socket.on("connect",function(e){console.log("connect"),socket.emit("join","Hello World from client"),socket.on("userid",function(e){userId=e});var t=Bacon.fromBinder(function(e){socket.on("update",function(t){e(t)})}),n=Bacon.fromBinder(function(e){socket.on("messages",function(t){e(t)})});processElements(t,n)});
//# sourceMappingURL=spreadsheet.js.map
