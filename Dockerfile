FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/compliance-mock/package.json apps/compliance-mock/package.json
RUN npm ci
COPY apps apps
COPY database database
RUN npm run build
CMD ["npm","run","start","-w","apps/api"]
