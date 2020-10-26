#!/bin/bash
# wait_for_dependencies.sh -- accepts a command to run after connections to all dependencies are confirmed
set -e

cmd="$@"

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
