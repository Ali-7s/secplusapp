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

export BACKEND_URL
echo "Using BACKEND_URL: $BACKEND_URL"

# Substitute only BACKEND_URL so nginx \$variable syntax is preserved
envsubst '${BACKEND_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
