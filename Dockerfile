FROM node:20.0.0-bullseye-slim
LABEL org.opencontainers.image.source="https://github.com/SteinTokvam/portfolio-watch"
WORKDIR /app
COPY package.json /app
COPY /src /app/src
COPY /public /app/public
COPY tsconfig.json /app
COPY *.db* /app

RUN npm install
RUN npm run build
ENV NODE_ENV production
RUN chown -R node:node /app/dist
RUN chown -R node:node /app/*.db*
USER node
CMD ["node", "dist/index.js"]