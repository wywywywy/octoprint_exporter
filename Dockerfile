FROM node:12-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN npm i -g npm@6

COPY package*.json /usr/src/app/
RUN npm ci

COPY octoprint_exporter.js /usr/src/app/

EXPOSE 9529
ENV OCTOPRINT_PORT=9529 OCTOPRINT_INTERVAL=10 OCTOPRINT_HOSTIP=127.0.0.1 OCTOPRINT_HOSTPORT=80 DEBUG=0 

ENTRYPOINT [ "npm", "start" ]
