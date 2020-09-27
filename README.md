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
```
