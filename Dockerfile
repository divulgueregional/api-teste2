FROM node:16-alpine

RUN apk update && apk add build-base git python3 

COPY package.json .
COPY package-lock.json .
COPY ./src ./src
COPY ./dist ./dist
COPY ./instances_data ./instances_data
COPY ./instance_data ./instance_data
COPY .env .

RUN npm install

EXPOSE 8081
ENV PORT 8081
ENV NODE_ENV production

CMD ["npm", "run", "start:prod"]
