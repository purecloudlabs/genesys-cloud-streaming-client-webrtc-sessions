cd $WORKSPACE/repo

# Generate .npmrc for artifactory
rm -rf ./npm-utils && git clone --depth=1 git@bitbucket.org:inindca/npm-utils.git ./npm-utils
source ./npm-utils/scripts/jenkins-pre-build.sh ${NODE_VERSION} -m
