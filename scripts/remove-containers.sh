#!/bin/bash

# Remove stopped containers
docker container ls -a --format='{{.ID}}' \
    | xargs docker rm
