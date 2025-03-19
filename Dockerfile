FROM node:20.0.0-bullseye-slim
LABEL org.opencontainers.image.source="https://github.com/SteinTokvam/portfolio-watch"
WORKDIR /app
COPY package.json /app
COPY /src /app/src
COPY /public /app/public
COPY tsconfig.json /app

RUN npm install
RUN npm run build
ENV NODE_ENV production
RUN chown -R node:node /app/dist
USER node
CMD ["node", "dist/index.js"]