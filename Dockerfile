FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install all dependencies including dev dependencies for build
RUN npm ci && npm cache clean --force

COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --omit=dev && npm cache clean --force

# Remove CLI packages since we don't need them in production
RUN npm remove @shopify/cli

CMD ["npm", "run", "docker-start"]
