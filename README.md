# Integration Tests

Tests can be added to `packages/integration-tests`. These tests are built into a
Docker container and ran with `docker-compose` along with the rest of the stack.

## Running in CI

When this runs in CI, it references the `latest` images in ECR for:
* Postgres
* Rollup Services
* L2 Geth
* Ganache CLI (for simulating L1)

## Running locally

This repo can be ran locally against Docker images built from arbitrary git
refs. `scripts/test.sh` will autotmatically build images that don't already
exist and run them as part of the integration test suite.

```bash
$ ./scripts/test.sh -h

Build docker images and test using git branches.

CLI Arguments:
  -m|--microservices   - microservices branch
  -p|--postgres        - postgres branch
  -g|--gethl2          - gethl2 branch

Default values are master.
Will rebuild if new commits to a branch are detected.

Example:
$ ./scripts/test.sh -p master -m new-feature-x -g new-feature-y
```
