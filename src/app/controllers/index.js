'use strict';
// this controller is meant to set up routes from all other controllers
// it also sets up basic express routes

import {
  Router
}
from 'express';

//import extrasController from './extras';

// create router
const router = Router();
// load other controllers
//router.use('/extras', extrasController);

// set basic routes
router.get('/', (req, res) => res.render('index', {
  title: 'msc-project'
}));

// export router
export default router;
