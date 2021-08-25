Octoprint exporter for Prometheus.io, written in Node.js 12.

This exporter provides metrics for the current print job and tools/bed in Octoprint.

# Usage

## Arguments

    --port     9529         Exporter listens on this port (default = 9529)
    --interval 15           Polling interval in seconds (default = 15, minimum 2)
    --apikey   ABCDEF123    Octoprint API key (mandatory)
    --hostip   127.0.0.1    Octoprint IP (default = 127.0.0.1)
    --hostport 80           Octoprint port (default = 8080, or 443 if using SSL)
    --hostssl               Use SSL to connect to Octoprint
    --collectdefault        Collect default Prometheus metrics as well (default = false)

## Environment Variables

The arguments can also be set as env variables instead. Useful if you're using it in a Docker container.
1. OCTOPRINT_PORT
2. OCTOPRINT_INTERVAL
3. OCTOPRINT_APIKEY
4. OCTOPRINT_HOSTIP
5. OCTOPRINT_HOSTPORT
6. OCTOPRINT_HOSTSSL
7. OCTOPRINT_DEFAULTMETRICS

# Installation

## From Source

Node 8 is required to run it.

    git clone git@github.com:wywywywy/octoprint_exporter.git
    cd octoprint_exporter
    npm install
    npm start

Recommend npm version >= 6.

## With Docker

    docker run -d --restart=always -p 9529:9529 -e OCTOPRINT_APIKEY='ABCDEF123' wywywywy/octoprint_exporter:latest

## Prometheus Config

Add this to prometheus.yml and change the IP/port if needed.

    - job_name: 'octoprint_exporter'
        metrics_path: /
        static_configs:
        - targets:
            - '127.0.0.1:9529'

# TODO

1. ?

# Contributing

Yes, contributions are always welcome.  
Fork it, clone it, submit a pull request, etc.

# License

This is licensed under the Apache License 2.0.
