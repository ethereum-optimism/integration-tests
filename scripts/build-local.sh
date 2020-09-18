#!/bin/bash

# Copyright Optimism PBC, 2020
# MIT License

MICROSERVICES_GIT_REF=${MICROSERVICES_GIT_REF:-"master"}
POSTGRES_GIT_REF=${POSTGRES_GIT_REF:-"master"}
GETH_L2_GIT_REF=${GETH_L2_GIT_REF:-"master"}

MICROSERVICES_TAG=${MICROSERVICES_TAG:-"master"}
POSTGRES_TAG=${POSTGRES_TAG:-"master"}
GETH_L2_TAG=${GETH_L2_TAG:-"master"}

TEMP=/tmp/optimistic-rollup-integration-tests
mkdir -p $TEMP

cd "$TEMP"

if [ ! -d "optimism-monorepo"  ]; then
    git clone https://github.com/ethereum-optimism/optimism-monorepo.git
fi

if [ ! -d "go-ethereum" ]; then
    git clone https://github.com/ethereum-optimism/go-ethereum
fi

(
    HAS_MICROSERVICES=$(docker images eth-optimism/rollup-microservices \
        --format='{{.Tag}}' | grep $MICROSERVICES_TAG)

    if [[ -z "$HAS_MICROSERVICES" ]]; then
        cd optimism-monorepo
        git checkout "$MICROSERVICES_GIT_REF"
        yarn install
        docker build -t eth-optimism/rollup-microservices:$MICROSERVICES_TAG .
    fi

    HAS_POSTGRES=$(docker images eth-optimism/postgres \
        --format='{{.Tag}}' | grep $POSTGRES_TAG)

    if [[ -z "$HAS_POSTGRES" ]]; then
        cd db
        docker build -t eth-optimism/postgres:$POSTGRES_TAG .
    fi
)

(
    HAS_L2_GETH=$(docker images eth-optimism/geth \
        --format='{{.Tag}}' | grep $GETH_L2_TAG)

    if [[ -z "$HAS_L2_GETH" ]]; then
        cd go-ethereum
        git checkout "$GETH_L2_GIT_REF"
        docker build -t eth-optimism/geth:$GETH_L2_TAG .
    fi
)
