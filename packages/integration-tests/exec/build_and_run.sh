#!/bin/bash
# build_and_run.sh -- accepts a command to run after dependency connections succeed
# conditionally builds based on REBUILD env var and then calls wait_for_dependencies.sh

# Exits if any command fails
set -e

cmd=$@

ROOT_DIR=../../..


if [ -n "$REBUILD" ]; then
  echo -e "\n\nREBUILD env var set, rebuilding...\n\n"

  if [ -n "$FETCH_DEPS" ]; then
    echo -e "\nFetching dependencies (this will take forever the first time time)..."
    yarn --cwd $ROOT_DIR --verbose --frozen-lockfile
  fi

  yarn --cwd $ROOT_DIR clean
  yarn --cwd $ROOT_DIR build
  echo -e "\n\nCode built proceeding with ./wait_for_dependencies.sh...\n\n"
else
  echo -e "\n\nREBUILD env var not set, calling ./wait_for_dependencies.sh without building...\n\n"
fi

exec $(dirname $0)/wait_for_dependencies.sh "$cmd"
