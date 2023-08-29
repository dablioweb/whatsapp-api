let express = require('express');
let router = express.Router();
const userController = require('../controllers/user.controller');


//Form Login
router.get('/', function(req, res, next) {
  const errorMessage = '';
  res.render('login', { showError: false, errorMessage });
});

router.post('/', function (req, res, next) {

  userController.login(req, res, function (err, user) {
    if (err) {
      res.end("Error: " + err);
    } else {
      if (user) {
        req.session.email = user.email;
        res.redirect('/apiweb');
      } else {
        res.redirect('/login?invalid=true');
      }

    }
  });
});

module.exports = router;
