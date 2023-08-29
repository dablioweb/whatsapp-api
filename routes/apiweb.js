require('dotenv').config();
let express = require('express');
const { authenticateToken } = require('../middleware/auth');
let router = express.Router();
let emailvalor = null;
const jwt = require('jsonwebtoken')

router.get('/', (req, res, next) => {
   /* const jwtCookie = req.cookies['access_token'];
    if (jwtCookie) {
        try {
            const decodedToken = jwt.verify(jwtCookie, process.env.ACCESS_TOKEN_SECRET);
            global.emailvalor = decodedToken.data;
            console.log(global.emailvalor)
        } catch (err) {
            console.log(err)
        }
    } else {
        console.log('sem cookies')
    } */
    res.render('apiweb', { valoremail: global.emailvalor });
});

router.post('/', authenticateToken, (req, res, next) => {
    res.render('apiweb', { title: 'API' });
});

module.exports = router;
