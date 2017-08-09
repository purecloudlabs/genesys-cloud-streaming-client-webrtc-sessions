# Automatically terminate if command returns error exit code
set -e

##### Setup .npmrc to use artifactory #####
source ./repo/scripts/prebuild.sh
#
cd $WORKSPACE/repo

# run NPM install
npm install

## Run npm test
npm test
