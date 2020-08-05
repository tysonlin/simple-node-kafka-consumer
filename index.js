// Environment Variables
// KAFKA_CONFIG_PATH: Path to Kafka .config, defaults to: 'localhost.config', individual fields declared as separate envvar will be overwritten
// KAFKA_CONSUME_TOPIC: Topic name to comsume messages, defaults to: 'test'
// KAFKA_CONSUME_ENCRYPTED_TOPIC: Topic name to comsume encrypted messages, defaults to: 'test-encrypted'
// BROKER_ENDPOINT: Kafka broker endpoint

// for Confluent cloud
// CLUSTER_API_KEY: ccloud key
// CLUSTER_API_SECRET: ccloud secret

// for encryption
// CRYPTO_KEY: Crypto key
// CRYPTO_IV: Crypto IV
// DECRYPTION_ALGORITHM: decryption algorithm, defaults to: 'aes-256-cbc'

// database 
// DB_CONFIG_PATH: Config file for database, defaults to: 'localhost_db.config', individual fields declared as separate envvar will be overwritten
// DB_HOST: Database hostname
// DB_NAME: Database name
// DB_USER: Database username
// DB_PASSWORD: Database password

const express = require("express");
const app = express();

const RdkafkaStats = require('node-rdkafka-prometheus');
const rdkafkaStats = new RdkafkaStats();

const promBundle = require("express-prom-bundle");
const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    metricType: "summary",
    promClient: {
        collectDefaultMetrics: {
        }
    },
});

const crypto = require('crypto');

const logger = require('./logger');
const ConsumerFactory = require('./consumer');
const DbFactory = require('./db');
const ConfigReader = require('./config');

// health endpoint
// calls to this route will not appear in metrics
app.get("/health", (req, res) => res.json({"status":"healthy"}));

// register middlewares
app.use(express.json()) 
app.use(metricsMiddleware);

// kafka comsumer init
let consumer;

(async () => {
    let kafkaConfig = await ConfigReader.read(process.env.KAFKA_CONFIG_PATH || 'localhost.config');
    let dbConfig = await ConfigReader.read(process.env.DB_CONFIG_PATH || 'localhost_db.config');

    const dbPool = DbFactory.getPool(dbConfig);

    // normal message consumption
    let topic = process.env.KAFKA_CONSUME_TOPIC || 'test';
    let consumerSeen = 0;

    // encrypted message consumption
    let encryptedTopic = process.env.KAFKA_CONSUME_ENCRYPTED_TOPIC || 'test-encrypted';
    let algorithm = process.env.DECRYPTION_ALGORITHM || 'aes-256-cbc';
    let encryptedConsumerSeen = 0;
    const cryptoKey = process.env.CRYPTO_KEY || crypto.randomBytes(32);
    const cryptoIv = process.env.CRYPTO_IV || crypto.randomBytes(16);

    consumer = await ConsumerFactory.createConsumer(kafkaConfig, (event) => {
        let {key, value, partition, offset, topic} = event;

        // encrypted record
        if (topic === encryptedTopic) {
            let decipher = crypto.createDecipheriv(algorithm, Buffer.from(cryptoKey), cryptoIv);
            let decrypted = decipher.update(Buffer.from(value.toString(), 'hex'));
            value = Buffer.concat([decrypted, decipher.final()]);
        }

        logger.info(`Consumed ${(topic === encryptedTopic)?'encrypted ':''}record with key ${key} and value ${value} of partition ${partition} @ offset ${offset}. Updated total count to ${(topic === encryptedTopic)?++encryptedConsumerSeen:++consumerSeen}`);

        let query = 'INSERT INTO consumed (`key`,`value`,`partition`,`offset`,`topic`) VALUES (?,?,?,?,?);';
        let values = [key, value, partition, offset, topic];

        // db write
        dbPool.execute(query, values, (err, results, fields) => {
            if (err) {
                logger.error('DB Write Error: ');
                logger.error(err);
            }
            else {
                logger.debug(`DB Write Success insertId: ${results.insertId}`);
            }
        });
    });

    // register consumer stats
    consumer.on('event.stats', msg => {
        let stats = JSON.parse(msg.message);
        rdkafkaStats.observe(stats);
      });

    consumer.subscribe([topic, encryptedTopic]);
    consumer.consume();
})();


const server = app.listen(process.env.PORT || 3000);

// graceful termination
function cleanup() {
    server.close(() => {
        consumer.disconnect(() => {
            process.exit(0);
        });
    });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
