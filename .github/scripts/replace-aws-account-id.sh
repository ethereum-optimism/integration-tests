#!/bin/bash

sed -i '' -E 's/<AWS_CI_AWS_ACCOUNT_ID>/'"$AWS_ACCOUNT_ID"'/g' ../../docker-compose.ci.yml

