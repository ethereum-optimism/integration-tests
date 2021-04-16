#!/bin/bash
git clone --depth=1 --branch develop https://github.com/Synthetixio/synthetix.git
cd synthetix
npm install
node publish deploy-ovm-pair
npm run test:prod:ovm
