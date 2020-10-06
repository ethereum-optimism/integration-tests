#!/bin/bash

# Copyright Optimism PBC, 2020
# MIT License

USAGE="
$ ./scripts/test.sh
Build docker images and test using git branches.

CLI Arguments:
  -m|--microservices   - microservices branch
  -p|--postgres        - postgres branch
  -g|--gethl2          - gethl2 branch
  -l|--logs            - grep -E log filter

Default values for branches are master.
Will rebuild if new commits to a branch are detected.


For filtering logs with -l, use the | to delimit names of services.
Possible services are geth_l2, postgres, l1_chain, integration_tests.
Example:
$ ./scripts/test.sh -l 'geth_l2|integration_tests'

Example:
$ ./scripts/test.sh -p master -m new-feature-x -g new-feature-y
"

SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" > /dev/null && pwd )"
BASE_DIR="$SCRIPTS_DIR/.."

# default grep filter for logging specific services
LOG_FILTER='microservices|integration_tests|postgres|geth_l2'

MICROSERVICES_GIT_REF=${MICROSERVICES_GIT_REF:-master}
POSTGRES_GIT_REF=${POSTGRES_GIT_REF:-master}
GETH_L2_GIT_REF=${GETH_L2_GIT_REF:-master}

FILTER='label=com.docker.compose.project=optimistic-rollup-integration-tests'

# delete stopped containers so that volumes can be pruned cleanly
docker rm $(docker container ls -a \
    --filter="$FILTER" \
    --format='{{.ID}}') 2&>/dev/null

docker volume rm -f \
    $(docker volume ls --filter="$FILTER" --format='{{.Name}}') 2&>/dev/null

while (( "$#" )); do
  case "$1" in
    -m|--microservices)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        MICROSERVICES_GIT_REF="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        exit 1
      fi
      ;;
    -p|--postgres)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        POSTGRES_GIT_REF="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        exit 1
      fi
      ;;
    -g|--gethl2)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        GETH_L2_GIT_REF="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        exit 1
      fi
      ;;
    -l|--logs)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        LOG_FILTER="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        exit 1
      fi
      ;;
    -h|--help)
      echo "$USAGE"
      exit 0
      ;;
    *)
      echo "Unknown argument $1" >&2
      shift
      ;;
  esac
done

# valid characters for git refs but not for container tags
# must be replaced at this step.
MICROSERVICES_TAG=$(echo $MICROSERVICES_GIT_REF | sed 's/\//_/')
POSTGRES_TAG=$(echo $POSTGRES_GIT_REF | sed 's/\//_/')
GETH_L2_TAG=$(echo $GETH_L2_GIT_REF | sed 's/\//_/')

MICROSERVICES_GIT_REF=$MICROSERVICES_GIT_REF \
POSTGRES_GIT_REF=$POSTGRES_GIT_REF \
GETH_L2_GIT_REF=$GETH_L2_GIT_REF \
MICROSERVICES_TAG=$MICROSERVICES_TAG \
POSTGRES_TAG=$POSTGRES_TAG \
GETH_L2_TAG=$GETH_L2_TAG \
    $SCRIPTS_DIR/build-local.sh

# The directory name must match the package name with @eth-optimism/ prefix
for PACKAGE_PATH in $BASE_DIR/packages/*; do
    [ -e "$PACKAGE_PATH" ] || continue
    PKGS=$(basename $PACKAGE_PATH)
    echo "Running $PKGS test suite"

    docker-compose -f docker-compose.local.yml rm -f
    docker volume ls \
        --filter='label=com.docker.compose.project=optimistic-rollup-integration-tests' \
        | xargs docker volume rm 2&>/dev/null

    MICROSERVICES_TAG=$MICROSERVICES_TAG \
    POSTGRES_TAG=$POSTGRES_TAG \
    GETH_L2_TAG=$GETH_L2_TAG \
    PKGS=$PKGS \
        docker-compose -f $BASE_DIR/docker-compose.local.yml \
            up \
            --exit-code-from integration_tests \
            --abort-on-container-exit
done
