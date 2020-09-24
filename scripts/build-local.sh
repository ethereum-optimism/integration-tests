#!/bin/bash

# Copyright Optimism PBC, 2020
# MIT License

MICROSERVICES_GIT_REF=${MICROSERVICES_GIT_REF:-"master"}
POSTGRES_GIT_REF=${POSTGRES_GIT_REF:-"master"}
GETH_L2_GIT_REF=${GETH_L2_GIT_REF:-"master"}

MICROSERVICES_TAG=${MICROSERVICES_TAG:-"master"}
POSTGRES_TAG=${POSTGRES_TAG:-"master"}
GETH_L2_TAG=${GETH_L2_TAG:-"master"}

PROJECT_LABEL="com.docker.compose.project=optimistic-rollup-integration-tests"
COMPOSE_SERVICE_LABEL_KEY="com.docker.compose.service"
GIT_BRANCH_LABEL_KEY="io.optimism.repo.git.branch"
GIT_COMMIT_LABEL_KEY="io.optimism.repo.git.hash"

REMOTE=origin
TEMP=/tmp/optimistic-rollup-integration-tests
mkdir -p "$TEMP"

cd "$TEMP"
if [ ! -d "optimism-monorepo"  ]; then
    git clone https://github.com/ethereum-optimism/optimism-monorepo.git
fi
if [ ! -d "go-ethereum" ]; then
    git clone https://github.com/ethereum-optimism/go-ethereum
fi

# build the microservices
cd "$TEMP/optimism-monorepo"
git pull "$REMOTE"

MICROSERVICES_GIT_HASH=$(git rev-parse "$MICROSERVICES_GIT_REF")
# if the latest microservices aren't build, then build them
HAS_MICROSERVICES=$(docker images eth-optimism/rollup-microservices \
    --filter "label=$PROJECT_LABEL" \
    --filter "label=$COMPOSE_SERVICE_LABEL_KEY=microservices" \
    --filter "label=$GIT_COMMIT_LABEL_KEY=$MICROSERVICES_GIT_HASH" \
    --format='{{.ID}}')

# the dockerfile for the microservices is in optimism-monorepo
# and the dockerfile for the db is in optimism-monorepo/db.
if [[ -z "$HAS_MICROSERVICES" ]]; then
    git checkout "$MICROSERVICES_GIT_REF"
    git pull
    yarn install --frozen-lockfile
    echo "Building eth-optimism/rollup-microservices:$MICROSERVICES_TAG"
    docker build \
        --label "$PROJECT_LABEL" \
        --label "$COMPOSE_SERVICE_LABEL_KEY=microservices" \
        --label "$GIT_BRANCH_LABEL_KEY=$MICROSERVICES_GIT_REF" \
        --label "$GIT_COMMIT_LABEL_KEY=$MICROSERVICES_GIT_HASH" \
        -t eth-optimism/rollup-microservices:$MICROSERVICES_TAG .
fi

# build postgres
cd "$TEMP/optimism-monorepo/db"
POSTGRES_GIT_HASH=$(git rev-parse "$POSTGRES_GIT_REF")
HAS_POSTGRES=$(docker images eth-optimism/postgres \
    --filter "label=$PROJECT_LABEL" \
    --filter "label=$COMPOSE_SERVICE_LABEL_KEY=postgres" \
    --filter "label=$GIT_COMMIT_LABEL_KEY=$POSTGRES_GIT_HASH" \
    --format='{{.ID}}')

if [[ -z "$HAS_POSTGRES" ]]; then
    git checkout "$POSTGRES_GIT_REF"
    git pull
    echo "Building eth-optimism/postgres:$POSTGRES_TAG"
    docker build \
        --label "$PROJECT_LABEL" \
        --label "$COMPOSE_SERVICE_LABEL_KEY=postgres" \
        --label "$GIT_BRANCH_LABEL_KEY=$POSTGRES_GIT_REF" \
        --label "$GIT_COMMIT_LABEL_KEY=$POSTGRES_GIT_HASH" \
        -t eth-optimism/postgres:$POSTGRES_TAG .
fi

# build l2 geth
cd "$TEMP/go-ethereum"
git pull "$REMOTE"
GETH_L2_GIT_HASH=$(git rev-parse "$GETH_L2_GIT_REF")
HAS_L2_GETH=$(docker images eth-optimism/geth \
    --filter "label=$PROJECT_LABEL" \
    --filter "label=$COMPOSE_SERVICE_LABEL_KEY=geth_l2" \
    --filter "label=$GIT_COMMIT_LABEL_KEY=$GETH_L2_GIT_HASH" \
    --format='{{.ID}}')

if [[ -z "$HAS_L2_GETH" ]]; then
    git checkout "$GETH_L2_GIT_REF"
    git pull
    echo "Building eth-optimism/geth:$GETH_L2_TAG"
    docker build \
        --label "$PROJECT_LABEL" \
        --label "$COMPOSE_SERVICE_LABEL_KEY=geth_l2" \
        --label "$GIT_BRANCH_LABEL_KEY=$GETH_L2_GIT_REF" \
        --label "$GIT_COMMIT_LABEL_KEY=$GETH_L2_GIT_HASH" \
        -t eth-optimism/geth:$GETH_L2_TAG .
fi
