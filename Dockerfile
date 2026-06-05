# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Vite inlines these into the static bundle at build time, so they must be
# present during `npm run build` (they cannot be injected at container runtime).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_LINEAR_CLIENT_ID
ARG VITE_LINEAR_REDIRECT_URI
ARG VITE_SKIP_LANDING=false
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_LINEAR_CLIENT_ID=$VITE_LINEAR_CLIENT_ID \
    VITE_LINEAR_REDIRECT_URI=$VITE_LINEAR_REDIRECT_URI \
    VITE_SKIP_LANDING=$VITE_SKIP_LANDING

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
