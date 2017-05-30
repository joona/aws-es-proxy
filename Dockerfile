FROM node:6

ENV TINI_VERSION v0.14.0

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
ADD package.json /usr/src/app/
RUN npm install && npm cache clean
COPY . /usr/src/app

# Add Tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

EXPOSE 9200
CMD [ "bin/aws-es-proxy" , "--"]
