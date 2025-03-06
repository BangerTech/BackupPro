FROM node:20-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    netcat-openbsd \
    smbclient \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Build TypeScript
RUN npm run build

COPY wait-for-db.sh /wait-for-db.sh
RUN chmod +x /wait-for-db.sh

EXPOSE 4000

ENV NODE_ENV=production

CMD ["/wait-for-db.sh", "postgres", "npm", "run", "start"] 