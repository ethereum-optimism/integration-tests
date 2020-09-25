#!/bin/bash

# This script will start up a postgres container and mount the docker
# volume used by the integration test suite in so that tools like `psql`
# or pgadmin can observe the data in the database after integration tests
# are ran.

# The first argument is expected to be the tag, otherwise master is used

TAG=${1:-"master"}
IMAGE="eth-optimism/postgres"

echo "Starting container $IMAGE:$TAG"

docker run --rm \
    -p 5432:5432 \
    -v optimistic-rollup-integration-tests_postgres:/var/lib/postgresql/data \
    "$IMAGE:$TAG"
