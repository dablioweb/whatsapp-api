const mysql = require('mysql2/promise');
const dbConfig = require('../config/db.config');

const pool = mysql.createPool({
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
    connectionLimit: 10, // The maximum number of connections to create at once
    queueLimit: 5 // The maximum number of connection requests the pool can queue before throwing an error
})

pool.on('error', (err) => {
    console.error('MySQL pool error', err);
});

const userSchema = {
    username: {
        type: 'varchar(35)',
        allowNull: false
    },
    email: {
        type: 'VARCHAR(255)',
        allowNull: false,
        unique: true
    },
    password: {
        type: 'VARCHAR(255)',
        allowNull: false
    },
    create_time: {
        type: 'DATETIME',
        defaultValue: mysql.raw('CURRENT_TIMESTAMP')
    },
    max_sessions: {
        type: 'INT(5)',
        defaultValue: 3
    }
};

const User = {
    create: async (userData) => {
        const [result] = await pool.query('INSERT INTO users SET ?', userData);
        return result.insertId;
    },

    findByEmail: async (email) => {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    },
    getMaxSessionsByEmail: async (email) => {
        const [rows] = await pool.query('SELECT MAX(max_sessions) as max_sessions FROM users WHERE email = ?', [email]);
        return rows[0].max_sessions;

    }
};

process.on('beforeExit', async () => {
    await pool.end();
});

module.exports = User;

