// https://github.com/confluentinc/examples/blob/5.5.1-post/clients/cloud/nodejs/consumer.js

const Kafka = require('node-rdkafka');

exports.createConsumer = (config, onData) => {
    let envDefaultOptions = {
        'bootstrap.servers': process.env.BROKER_ENDPOINT || config['bootstrap.servers'] || 'localhost:9092',
        'sasl.username': process.env.CLUSTER_API_KEY || config['sasl.username'],
        'sasl.password': process.env.CLUSTER_API_SECRET || config['sasl.password'],
        'security.protocol': config['security.protocol'] || 
                            (process.env.CLUSTER_API_KEY && process.env.CLUSTER_API_SECRET)? 'SASL_SSL' :'PLAINTEXT',
        'sasl.mechanisms': config['sasl.mechanisms'] || 'PLAIN',
        'group.id': config['group.id'] || 'node-example-group-1'
      };

    let consumerOptions = Object.assign(config, envDefaultOptions);

    console.debug(`Creating consumer with config ${JSON.stringify(consumerOptions)}`);

    const consumer = new Kafka.KafkaConsumer(consumerOptions, {
            'auto.offset.reset': 'earliest'
        });

    return new Promise((resolve, reject) => {
        consumer
            .on('ready', () => resolve(consumer))
            .on('data', onData)
            .on('subscribed', (topics) => console.log(`Subscribed to: ${JSON.stringify(topics)}`));

        consumer.connect();
    });
};