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

cd -

# Remove the pre-push hook during git tagging.
# This may have been added during npm install and pre-push package.
rm -f .git/hooks/pre-push

# Publish the module
./npm-utils/scripts/version-and-publish.sh
