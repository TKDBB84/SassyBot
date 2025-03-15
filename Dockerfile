FROM node:18-alpine as builder
LABEL authors="tkdbb84"

WORKDIR /home/node/
USER node

COPY --chown=node:node package* ./

RUN npm ci --omit=dev

COPY . ./

RUN npm run build

FROM node:18-alpine as sassybot
LABEL authors="tkdbb84"

WORKDIR /home/node/
USER node

COPY --chown=node:node --from=builder /home/node/dist ./dist
COPY --chown=node:node --from=builder /home/node/node_modules ./node_modules
COPY --chown=node:node --from=builder /home/node/package* ./


ENV NODE_ENV=production
ENV TYPEORM_CONNECTION=mysql
ENV TYPEORM_HOST=database
ENV TYPEORM_DRIVER_EXTRA='{"charset": "utf8mb4"}'
ENV TYPEORM_SYNCHRONIZE=false
ENV TYPEORM_LOGGING=false
ENV TYPEORM_ENTITIES="entity/*.js,modules/**/entity/*.js"
ENV LOG_LEVEL=debug

ENTRYPOINT ["node", "dist/Sassybot.js"]
