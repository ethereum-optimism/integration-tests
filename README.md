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

Build docker images and test using git refs.

CLI Arguments:
  -m|--microservices   - git ref of microservices
  -p|--postgres        - git ref of postgres
  -g|--gethl2          - git ref of gethl2

Default values are master.
It is recommended to use git hashes, but any git ref works.

Example:
$ ./scripts/test.sh -p master -m new-feature-x -g new-feature-y
```
