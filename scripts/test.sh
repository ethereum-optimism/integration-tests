#!/bin/bash

# Copyright Optimism PBC, 2020
# MIT License

USAGE="
$ ./scripts/test.sh
Build docker images and test using git refs.

CLI Arguments:
  -m|--microservices   - git ref of microservices
  -p|--postgres        - git ref of postgres
  -g|--gethl2          - git ref of gethl2

Default values are master.
It is recommended to use git hashes, but any git ref works.

Example:
$ ./scripts/test.sh -p master -m new-feature-x -g new-feature-y
"

SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" > /dev/null && pwd )"
BASE_DIR="$SCRIPTS_DIR/.."

MICROSERVICES_GIT_REF=master
POSTGRES_GIT_REF=master
GETH_L2_GIT_REF=master

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

MICROSERVICES_TAG=$MICROSERVICES_TAG \
POSTGRES_TAG=$POSTGRES_TAG \
GETH_L2_TAG=$GETH_L2_TAG \
    docker-compose \
        -f $BASE_DIR/docker-compose.local.yml up
