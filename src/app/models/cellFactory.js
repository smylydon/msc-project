/*
 * CellFactory
 */
var CellFactory = (function () {
	/**
	 * @Constructor
	 *
	 * @param {Object} json object containing cell data
	 */
	function Cell(data) {
		this.id = data.id;
		this.value = 0;
		this.formula = '';
		this.expanded = '0';
		this.lastUpdated = 0;
	}

	return {
		getNewCell: function (data) {
			return new Cell(data);
		}
	};
})();

// export CellFactory
export default CellFactory;
