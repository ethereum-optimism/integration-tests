#!/bin/bash
# wait_for_dependencies.sh -- accepts a command to run after connections to all dependencies are confirmed
set -e

cmd="$@"

RETRIES=30

echo "Connection info: ${POSTGRES_HOST}:${POSTGRES_PORT}, user=${POSTGRES_USER}, postgres db=${POSTGRES_DATABASE}"

until PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DATABASE -c "select 1" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for Postgres server, $((RETRIES--)) remaining attempts..."
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Timeout reached waiting for Postgres!"
  exit 1
fi

echo "Connected to Postgres"

RETRIES=30
echo "Connecting to L2 Geth..."
until $(curl --output /dev/null --silent --fail -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 9999999, "method": "net_version"}' $L2_NODE_WEB3_URL); do
  sleep 1
  echo "Will wait $((RETRIES--))) more times for $L2_NODE_WEB3_URL to be up..."

  if [ "$RETRIES" -lt 0 ]; then
    echo "Timeout waiting for l2 geth node at $L2_NODE_WEB3_URL"
    exit 1
  fi
done
echo "Connected to L2 geth!"


RETRIES=30
echo "Connecting to L1 Node..."
until $(curl --output /dev/null --silent --fail -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 9999999, "method": "net_version"}' $L1_NODE_WEB3_URL); do
  sleep 1
  echo "Will wait $((RETRIES--))) more times for $L1_NODE_WEB3_URL to be up..."

  if [ "$RETRIES" -lt 0 ]; then
    echo "Timeout waiting for l2 geth node at $L1_NODE_WEB3_URL"
    exit 1
  fi
done
echo "Connected to L1 Node!"


>&2 echo "Continuing with startup..."

exec $cmd
