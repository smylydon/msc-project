
import _ from 'lodash';
import CellFactory from './cellFactory';

/*
 * SpreadSheetFactory
 */
var SpreadSheetFactory = (function () {
	/**
	 * @Constructor
	 *
	 * @param {Array} optional array containing cell data.
	 */
	function SpreadSheet(cells) {
		this.cells = [];
		this.addCells(cells);
		this.browserTimestamp = false;
	}

	/**
	 * @method getCellById
	 * @description
	 * Returns the the first cell taht match the id
	 * or returns undefined.
	 *
	 * @param {string} id of cell
	 * @returns {Cell}
	 */
	SpreadSheet.prototype.getCellById = function (id) {
		return _.find(this.cells, {
			id: id
		});
	};

  /**
	 * @method getCellById
	 * @description
	 * Returns the the first cell taht match the id
	 * or returns undefined.
	 *
	 * @param {string} id of cell
	 * @returns {Cell}
	 */
	SpreadSheet.prototype.getCells = function () {
		return this.cells;
	};

	/**
	 * @method addCells
	 * @description
	 * Accepts an array of json objects. A collection of
	 * Cell objects are create using the json objects.
	 * The cells are added to collection of spreadsheet
	 * cells.
	 *
	 * @param {Array} an array of json objects
	 */
	SpreadSheet.prototype.addCells = function (cells) {
		cells = _.isArray(cells) ? cells : [];
		cells = cells.map(function(data) { return CellFactory.getNewCell(data); });
		Array.prototype.push.apply(this.cells, cells);
	};

	/**
	 * @method addCell
	 * @description
	 * Accepts a json objects. Creates a cell object and
	 * adds it to the collection of cells.
	 *
	 * @param {Array} a json
	 */
	SpreadSheet.prototype.addCell = function (data) {
		this.cells.push(CellFactory.getNewCell(data));
	};

	/**
	 * @method removeCellsById
	 * @description
	 * Accepts a list of cell ids. Cells matching each
	 * are removed one at a time from the collection
	 * of spreatsheet cells.
	 *
	 * @param {Array} a list of ids to remove
	 */
	SpreadSheet.prototype.removeCellsById = function (ids) {
		var that = this;
		ids = _.isArray(ids) ? ids : [];
		_.forEach(ids, function (id) {
			that.removeCellById(id);
		});
	};

	/**
	 * @method removeCellById
	 * @description
	 * Accepts an id of a cell that needs to be removed.
	 * Cells that match the id are removed one at a time
	 * from the collection of spreatsheet cells.
	 *
	 * @param {String} id the id of the cell to be removed
	 */
	SpreadSheet.prototype.removeCellById = function (id) {
		_.remove(this.cells,function (cell) { return cell.id === id;});
	};

	return {
		getSpreadSheet: function (cells) {
			return new SpreadSheet(cells);
		}
	};

})();

//var spreadSheet = SpreadSheetFactory.getSpreadSheet();

// export SpreadSheetFactory
export default SpreadSheetFactory;
