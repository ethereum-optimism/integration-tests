#!/bin/bash

echo "Current dir: $(pwd)"
echo "Dir name: $(dirname $0)"
echo "Dir contents: \n $(ls -alh)"

sed -i '' -E 's/<AWS_CI_AWS_ACCOUNT_ID>/'"$AWS_ACCOUNT_ID"'/g' ./docker-compose.ci.yml

