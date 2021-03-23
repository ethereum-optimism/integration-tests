git clone git@github.com:Synthetixio/synthetix.git
cd synthetix
git checkout develop
npm install
node publish deploy-ovm-pair
npm run test:prod:ovm
