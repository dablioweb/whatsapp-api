require('dotenv').config();
const jwt = require('jsonwebtoken');


function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(' ')[1];
    const access_token = req.cookies['access_token'];
    if (!token){
        try{
            jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
                if (err) return res.sendStatus(403);
                req.user = user;
                next();
            });
        }catch{
            return res.sendStatus(401);
        }
    }else{
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if(err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
}

function generateAccessToken(email) {
    const secretKey = process.env.ACCESS_TOKEN_SECRET;

    if (!secretKey) {
        throw new Error('ACCESS_TOKEN_SECRET environment variable is missing');
    }

    return jwt.sign({ data: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
}

module.exports = {
    authenticateToken,
    generateAccessToken,
};
