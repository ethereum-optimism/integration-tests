FROM node:11

# This is required for the wait_for_dependencies.sh script
RUN apt-get update
RUN apt-get install -y postgresql-client

WORKDIR /server
COPY . /server

RUN yarn
RUN yarn clean
RUN yarn build

WORKDIR /server/packages/integration-tests

ENTRYPOINT [ "bash", "./exec/wait_for_dependencies.sh", "yarn", "run", "ci" ]
