FROM node:6

WORKDIR /usr/app

RUN useradd -ms /bin/bash aws-es-proxy
RUN chown aws-es-proxy:aws-es-proxy /usr/app

ADD index.js /usr/app
ADD package.json /usr/app

RUN npm install

EXPOSE 9200

ENTRYPOINT ["node", "index.js"]
