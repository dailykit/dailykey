FROM node:7
WORKDIR /app
COPY package.json /app
RUN yarn --ignore-engines
COPY . /app
CMD node index.js
