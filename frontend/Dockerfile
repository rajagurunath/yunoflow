# Serve the pre-built Vite app with nginx (also proxies /api -> backend).
# The dist/ is built on the host first (see `make up` / `make frontend`);
# this avoids running a Node toolchain image, which fails to exec on some
# local Docker setups.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 80
