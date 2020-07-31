// get the client
const mysql = require('mysql2');

exports.getPool = (config) => {
    let mysqlDefaultConfig = {
        host: process.env.DB_HOST || config.host,
        user: process.env.DB_USER || config.user,
        password: process.env.DB_PASSWORD || config.password,
        database: process.env.DB_NAME || config.database,
        waitForConnections: config.waitForConnections || true,
        connectionLimit: config.connectionLimit || 10,
        queueLimit: config.queueLimit || 0
    };

    let mysqlConfig = Object.assign(config || {}, mysqlDefaultConfig);

    const pool = mysql.createPool(mysqlConfig);

    return pool;
}