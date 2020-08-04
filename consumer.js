// https://github.com/confluentinc/examples/blob/5.5.1-post/clients/cloud/nodejs/consumer.js
// https://medium.com/walkme-engineering/managing-consumer-commits-and-back-pressure-with-node-js-and-kafka-in-production-cfd20c8120e3

const logger = require('./logger');
const Kafka = require('node-rdkafka');
const async = require('async');

const maxQueueSize = process.env.MAX_QUEUE_SIZE - 0|| 1000;
const maxParallelHandles = process.env.MAX_PARALLEL_HANDLES - 0 || 200;

exports.createConsumer = (config, onData) => {
    const envDefaultOptions = {
        'bootstrap.servers': process.env.BROKER_ENDPOINT || config['bootstrap.servers'] || 'localhost:9092',
        'sasl.username': process.env.CLUSTER_API_KEY || config['sasl.username'],
        'sasl.password': process.env.CLUSTER_API_SECRET || config['sasl.password'],
        'security.protocol': config['security.protocol'] || 
                            (process.env.CLUSTER_API_KEY && process.env.CLUSTER_API_SECRET)? 'SASL_SSL' :'PLAINTEXT',
        'sasl.mechanisms': config['sasl.mechanisms'] || 'PLAIN',
        'group.id': config['group.id'] || 'node-example-group-1',
        'rebalance_cb': function (err, assignments) {
            if (err.code === Kafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS) {
                this.assign(assignments);
            } else if (err.code === Kafka.CODES.ERRORS.ERR__REVOKE_PARTITIONS) {
                if (paused) {
                    this.resume(assignments);
                    paused = false;
                    logger.info(`RESUME ON REBALANCE Queue for ${consumer.assignments()}`);
                }
                msgQueue.remove((d, p) => { return true; });
                this.unassign();
            } else {
                logger.error(`Rebalace error : ${err}`);
            }
        },
      };

    let consumerOptions = Object.assign(config, envDefaultOptions);

    logger.debug(`Creating consumer with config ${JSON.stringify(consumerOptions)}`);

    const consumer = new Kafka.KafkaConsumer(consumerOptions, {
            'auto.offset.reset': 'earliest'
        });

    let paused = false;
    
    const msgQueue = async.queue(async (data, done) => {
        logger.debug(`Handling [${msgQueue.length()}] topic: ${data.topic}, offset: ${data.offset}, partition: ${data.partition}`);
        await handleCB(data, onData);
        done();
    }, maxParallelHandles);

    msgQueue.drain(async () => {
        logger.info(`DRAINED Queue [${msgQueue.length()}] `);
        if (paused) {
          consumer.resume(consumer.assignments());
          paused = false;
          logger.info(`RESUME Queue [${msgQueue.length()}] for ${JSON.stringify(consumer.assignments())}`);
        }
    });
      
    const handleCB = async (data, handler) => {
        await handler(data);
    };

    return new Promise((resolve, reject) => {
        consumer
            .on('ready', () => resolve(consumer))
            .on('data', (data) => {
                msgQueue.push(data);
                logger.debug(`Queued [${msgQueue.length()}] topic: ${data.topic}, offset: ${data.offset}, partition: ${data.partition}`);
                if (msgQueue.length() > maxQueueSize && !paused) {
                    consumer.pause(consumer.assignments());
                    paused = true;
                    logger.info(`PAUSED Queue [${msgQueue.length()}] for ${JSON.stringify(consumer.assignments())}`);
                }
             })
            .on('subscribed', (topics) => logger.info(`Subscribed to: ${JSON.stringify(topics)}`));

        consumer.connect();
    });
};