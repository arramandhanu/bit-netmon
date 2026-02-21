const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const PORT = parseInt(process.env.BULL_BOARD_PORT || '3002', 10);

const connection = { host: REDIS_HOST, port: REDIS_PORT };

const queues = [
    new Queue('snmp-polling', { connection }),
    new Queue('alert-processing', { connection }),
    new Queue('device-discovery', { connection }),
    new Queue('metric-aggregation', { connection }),
];

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');

createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
});

const app = express();
app.use('/', serverAdapter.getRouter());

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bull Board running on http://0.0.0.0:${PORT}`);
    console.log(`Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
});
