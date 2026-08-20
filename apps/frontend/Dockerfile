FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG BACKEND_INTERNAL_URL=http://backend:8080
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.source="https://github.com/JasonTM17/HealthCare_Project"
ENV NODE_ENV=production
ENV BACKEND_INTERNAL_URL=http://backend:8080
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
