FROM node:12-alpine

# node-rdkafka dependencies
RUN apk --no-cache add \
      bash \
      g++ \
      ca-certificates \
      lz4-dev \
      musl-dev \
      cyrus-sasl-dev \
      openssl-dev \
      make \
      python

RUN apk add --no-cache --virtual .build-deps gcc zlib-dev libc-dev bsd-compat-headers py-setuptools bash

# node runtime source
WORKDIR /app
COPY . .
RUN npm install --production

CMD [ "node", "index.js" ]

EXPOSE 3000


