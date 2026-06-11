#!/bin/sh
set -e

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL is not set. Add it to your Railway frontend service variables."
  echo "Example: BACKEND_URL=https://your-backend.up.railway.app"
  exit 1
fi

# Auto-prepend https:// if the value has no scheme
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) BACKEND_URL="https://$BACKEND_URL" ;;
esac

# Read the system DNS resolver so nginx can resolve private hostnames at
# request time rather than startup time (avoids "host not found" on boot).
# IPv6 addresses must be wrapped in brackets for nginx resolver syntax.
RAW_RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf 2>/dev/null || echo "127.0.0.11")
case "$RAW_RESOLVER" in
  *:*) RESOLVER="[$RAW_RESOLVER]" ;;  # IPv6
  *)   RESOLVER="$RAW_RESOLVER"    ;;  # IPv4
esac

export BACKEND_URL RESOLVER
echo "Using BACKEND_URL: $BACKEND_URL"
echo "Using DNS resolver: $RESOLVER"

# Substitute only our two variables — nginx \$variables are left untouched
envsubst '${BACKEND_URL} ${RESOLVER}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
