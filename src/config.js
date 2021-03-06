'use strict';

import path from 'path';

export default {
	// address of mongodb
	db: process.env.MONGODB_URI || 'mongodb://localhost:27017/test',
	// environment
	env: process.env.NODE_ENV || 'development',
	// port on which to listen
	port: process.env.PORT || 5000,
	// path to root directory of this app
	root: path.normalize(__dirname)
};
