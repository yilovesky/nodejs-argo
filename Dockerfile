FROM node:18-alpine
WORKDIR /tmp
COPY . .
RUN apk add --no-cache openssl curl gcompat iproute2 coreutils bash && \
    npm install && \
    chmod -R 777 /tmp
EXPOSE 3000
CMD ["node", "index.js"]
