#!/bin/bash
# build_and_run.sh -- accepts a command to run after dependency connections succeed
# conditionally builds based on REBUILD env var and then calls wait_for_dependencies.sh

# Exits if any command fails
set -e

cmd=$@

if [ -n "$REBUILD" ]; then
  echo -e "\nRebuilding integration tests\n"

  if [ -n "$FETCH_DEPS" ]; then
    echo -e "\nFetching dependencies (this will take forever the first time time)..."
    yarn --frozen-lockfile --verbose
  fi

  yarn clean
  yarn build
else
  echo "Starting the integration tests"
  exec $(dirname $0)/wait_for_dependencies.sh "$cmd"
fi
