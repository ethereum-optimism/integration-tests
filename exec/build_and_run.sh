#!/bin/bash
# build_and_run.sh -- accepts a command to run after dependency connections succeed
# conditionally builds based on REBUILD env var and then calls wait_for_dependencies.sh

# Exits if any command fails
set -e

cmd=$@

echo "Starting the integration tests"
exec $(dirname $0)/wait_for_dependencies.sh "$cmd"
