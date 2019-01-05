#!/usr/bin/env node
'use strict';

// Requirements
const http = require('http');
const fetch = require("node-fetch");
const prom = require('prom-client');
const commandLineArgs = require('command-line-args')
const moment = require('moment');

// Constants
const appName = 'octoprint';
const labelNamesJob = ['host',];
const labelNamesTemp = ['name','host',];
const _debug = process.env.DEBUG;

// Get args and set options
const argOptions = commandLineArgs([
    { name: 'port', alias: 'p', type: Number, defaultValue: process.env.OCTOPRINT_PORT || 9529, },
    { name: 'interval', alias: 'i', type: Number, defaultValue: process.env.OCTOPRINT_INTERVAL || 10, },
    { name: 'hostip', type: String, defaultValue: process.env.OCTOPRINT_HOSTIP || '127.0.0.1', },
    { name: 'hostport', type: Number, defaultValue: process.env.OCTOPRINT_HOSTPORT || 80, },
    { name: 'apikey', type: String, defaultValue: process.env.OCTOPRINT_APIKEY },
    { name: 'hostssl', type: Boolean, },
    { name: 'collectdefault', type: Boolean, },
]);
if (!argOptions.apikey) {
    console.error('ERROR: Missing API key.  Use parameter --apikey or environment variable OCTOPRINT_APIKEY to set it.');
    process.exit(1);
}
const port = argOptions.port;
let interval = argOptions.interval;
if (interval < 2) {
    interval = 2;
}
const octoprintIP = argOptions.hostip;
let octoprintPort = argOptions.hostport;
const octoprintSsl = process.env.OCTOPRINT_HOSTSSL || argOptions.hostssl;
if (octoprintSsl) {
    octoprintPort = 443;
}
const collectDefaultMetrics = process.env.OCTOPRINT_DEFAULTMETRICS || argOptions.collectdefault;

// Initialize prometheus metrics.
const gaugeJobPercent = new prom.Gauge({
    'name': appName + '_job_progress_percent',
    'help': 'Progress of current job in percentage',
    'labelNames': labelNamesJob,
});
const gaugeJobElapsed = new prom.Gauge({
    'name': appName + '_job_progress_elapsed_seconds',
    'help': 'Current job elapsed time in seconds',
    'labelNames': labelNamesJob,
});
const gaugeJobLeft = new prom.Gauge({
    'name': appName + '_job_progress_left_seconds',
    'help': 'Current job time left in seconds',
    'labelNames': labelNamesJob,
});
const gaugeTempActual = new prom.Gauge({
    'name': appName + '_actual_temperature',
    'help': 'Device actual temperature',
    'labelNames': labelNamesTemp,
});
const gaugeTempOffset = new prom.Gauge({
    'name': appName + '_offset_temperature',
    'help': 'Device offset temperature',
    'labelNames': labelNamesTemp,
});
const gaugeTempTarget = new prom.Gauge({
    'name': appName + '_target_temperature',
    'help': 'Device target temperature',
    'labelNames': labelNamesTemp,
});

// Register all metrics
console.log(`INFO: Registering Prometheus metrics...`);
const register = new prom.Registry();
register.registerMetric(gaugeJobPercent);
register.registerMetric(gaugeJobElapsed);
register.registerMetric(gaugeJobLeft);
register.registerMetric(gaugeTempActual);
register.registerMetric(gaugeTempOffset);
register.registerMetric(gaugeTempTarget);
if (collectDefaultMetrics) {
    prom.collectDefaultMetrics({
        timeout: 5000,
        register: register,
        prefix: appName + '_',
    });
}

// Start gathering metrics
gatherMetrics();
setInterval(gatherMetrics, interval * 1000);

// Start Server.
console.log(`INFO: Starting HTTP server...`);
const server = http.createServer((req, res) => {
    // Only allowed to poll prometheus metrics.
    if (req.method !== 'GET') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('Support GET only');
        return;
    }
    debug('GET request recevied');
    res.setHeader('Content-Type', register.contentType);
    res.end(register.metrics());
}).listen(port);
server.setTimeout(20000);
console.log(`INFO: Octoprint exporter listening on port ${port}`);

// Build the Octoprint API URL
function buildUrl({
    ssl,
    ip,
    port,
    type,
}) {
    let protocol = 'http://';
    if (ssl) {
        port = 443;
        protocol = 'https://'
    }
    return protocol + ip + ':' + port + '/api/' + type;
}

// Get all devices of a particular device type from Octoprint
async function fetchFromOctoprint({
    type,
}) {
    try {
        debug(`API call of type ${type} requested`);
        let headers = {
            'X-Api-Key': argOptions.apikey,
        };
        let response = await fetch(buildUrl({ ssl: octoprintSsl, ip: octoprintIP, port: octoprintPort, type: type }), { headers: headers });
        let json = await response.json();
        debug(`API call of type ${type} received`);
        return json;
    } catch (err) {
        console.log('ERROR: Unable to connect to Octoprint.  Check IP and port.');
        console.log('ERROR: ' + err);
    }
}

function addMetric({
    gauge,
    value,
    name,
    host,
}) {
    if (value && !isNaN(value)) {
        let labels = {
            host: host,
        };
        if (name) {
            labels.name = name;
        }
        gauge.set(labels, value);
    }
}

// Main function to get the metrics for each container
async function gatherMetrics() {
    try {
        // Get all device type in parallel 
        let jobProgress = await fetchFromOctoprint({ type: 'job' });
        let temps = await fetchFromOctoprint({ type: 'printer' });

        // Reset all to zero before proceeding
        register.resetMetrics();

        // process job metrics
        if (jobProgress && jobProgress.progress) {
            addMetric({gauge: gaugeJobPercent, value: jobProgress.progress.completion, host: octoprintIP + ':' + octoprintPort})
            addMetric({gauge: gaugeJobElapsed, value: jobProgress.progress.printTime, host: octoprintIP + ':' + octoprintPort})
            addMetric({gauge: gaugeJobLeft, value: jobProgress.progress.printTimeLeft, host: octoprintIP + ':' + octoprintPort})
        }

        // process temp metrics
        if (temps && temps.temperature) {
            for (let tool in temps.temperature) {
                addMetric({gauge: gaugeTempActual, value: temps.temperature[tool].actual, name: tool, host: octoprintIP + ':' + octoprintPort})
                addMetric({gauge: gaugeTempOffset, value: temps.temperature[tool].offset, name: tool, host: octoprintIP + ':' + octoprintPort})
                addMetric({gauge: gaugeTempTarget, value: temps.temperature[tool].target, name: tool, host: octoprintIP + ':' + octoprintPort})
            }
        }

    } catch (err) {
        console.log('ERROR: ' + err);
    }
}

function debug(msg) {
    if (_debug) {
        console.log(`DEBUG: ${moment().format('YYYYMMDD-HHmmss')} ${msg}`);
    }
}