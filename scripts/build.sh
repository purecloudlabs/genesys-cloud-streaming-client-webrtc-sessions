# Automatically terminate if command returns error exit code
set -e

##### Setup .npmrc to use artifactory #####
source ./repo/scripts/prebuild.sh

cd $WORKSPACE/repo

# run NPM install
npm install

## Run npm test
npm test

# Remove the pre-push hook during git tagging.
# This was added during npm install and pre-push package.
# rm -f .git/hooks/pre-push

# Publish the module
# ./npm-utils/scripts/version-and-publish.sh

# Push the tag
# git push origin --tags
