let express = require('express');
let router = express.Router();
const userController = require('../controllers/user.controller');

//form registro
// router.get('/', function (req, res, next) {
//     res.render('registro', { title: 'Registrar' });
// });

router.post('/', userController.register);

// router.put('/', function (req, res, next) {
//     res.render('registro', { title: 'Registrar' });
// });

module.exports = router;
