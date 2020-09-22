#!/bin/bash

docker container ls -a \
    --filter='name=optimistic-rollup-integration-tests_integration_tests' \
    --format='{{.ID}}' \
    | xargs docker rm 2>/dev/null

docker images \
    optimistic-rollup-integration-tests_integration_tests \
    --format='{{.ID}}' \
    | xargs docker rmi 2>/dev/null

