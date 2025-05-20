FROM node:20.0.0-bullseye-slim as BUILD_IMAGE
LABEL org.opencontainers.image.source="https://github.com/SteinTokvam/portfolio-watch"
WORKDIR /app
COPY package-lock.json /app
COPY package.json /app
COPY /src /app/src
COPY /public /app/public
COPY tsconfig.json /app

RUN npm ci
RUN npm run build
RUN npm prune --production

FROM node:20.0.0-bullseye-slim
WORKDIR /app
COPY --from=BUILD_IMAGE /app/dist ./dist
COPY --from=BUILD_IMAGE /app/node_modules ./node_modules
COPY --from=BUILD_IMAGE /app/public ./public
ENV NODE_ENV production
RUN chown -R node:node /app/dist

USER node
CMD ["node", "dist/index.js"]