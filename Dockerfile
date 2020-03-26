FROM node:7
WORKDIR /app
COPY package.json /app
RUN yarn
COPY . /app
CMD node index.js