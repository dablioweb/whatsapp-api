const auth = require("../middleware/auth");
const User = require("../models/usermodel");
const bcrypt = require("bcrypt");



async function login({ email, password }, callback) {
    try {
        const user = await User.findByEmail(email);
        if (user != null) {
            if (bcrypt.compareSync(password, user.password)) {
                const token = auth.generateAccessToken(email);
                return callback(null, { ...user, token });
            } else {
                return callback({
                    message: "Email ou Senha inválidos!",
                });
            }
        } else {
            return callback({
                message: "Preencha todos os campos!",
            });
        }
    } catch (error) {
        return callback(error);
    }
}



async function register(params, callback) {
    if (params.email === undefined) {
        return callback({ message: "Email necessário" });
    }

    const userData = {
        username: params.username,
        email: params.email,
        password: params.password,
    };

    try {
        const userId = await User.create(userData);
        const user = await User.findByEmail(params.email);
        return callback(null, user);
    } catch (error) {
        return callback(error);
    }
}

module.exports = {
    login,
    register
}
