const bcrypt = require('bcrypt');
const userService = require('../services/user.services')
const auth = require('../middleware/auth')

exports.register = (req, res, next) => {
const { password } = req.body;
const salt = bcrypt.genSaltSync(10);


req.body.password = bcrypt.hashSync(password, salt);

userService.register(req.body, (error, result)=>{
    if(error){
        return next(error);
    } res.redirect('/login')
});
};


exports.login = (req, res, next) => {
    const { email, password } = req.body;

    userService.login({ email, password }, (error, result) => {
        if (error) {
            console.log(error);
            const errorMessage = 'Email ou senha inválidos!';
            res.render('login', { showError: true, errorMessage });
        }else{
        const accessToken = auth.generateAccessToken(email);
        console.log(accessToken);
        res.cookie('access_token', accessToken, {
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 * 1000, // duração 1 dia
        });
        res.redirect('/apiweb');
    }
    });
};


exports.autht = (req, res, next) => {
    const { email, password } = req.body;

    userService.login({ email, password }, (error, result) => {
        if (error) {
            console.log(error)
            return next(error);
        }
        const accessToken = auth.generateAccessToken(email)
        console.log(accessToken)

        res.cookie('access_token', accessToken, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // duração 1 dia
        });

        // Send the auth header along with the cookie
        res.set('Authorization', `Bearer ${accessToken}`);

        res.status(200).json({ message: "Logado com sucesso" })
    });
};

exports.user = (req, res, next) => {
    return res.status(200).json({ message:"autorizado"});
};
