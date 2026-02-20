FROM node:20-bullseye-slim AS build

WORKDIR /app

# install dependencies (install works without package-lock; quiet output)
COPY package.json package-lock.json* ./
RUN npm install --silent

# copy source and build
COPY . .
RUN npm run build

FROM nginx:stable-alpine

# copy built static files
COPY --from=build /app/dist /usr/share/nginx/html

# custom nginx config (will be added to image)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
