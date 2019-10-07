@Library('pipeline-library@webapp-pipelines') _

webappPipeline {
    slaveLabel = 'dev'
    nodeVersion = '10.16.2'
    useArtifactoryRepo = false
    projectName = 'streaming-client-webrtc-sessions'
    manifest = directoryManifest('dist')
    buildType = { env.BRANCH_NAME == 'master' ? 'MAINLINE' : 'CI' }
    publishPackage = { 'dev' }
    shouldDeployDev = { true }
    shouldDeployTest = { false }
    shouldTestProd = { false }

    buildStep = {
        sh('npm install && npm test && npm run build')
    }

    upsertCMStep = {
        sshagent(credentials: [constants.credentials.github.inin_dev_evangelists]) {
            sh("""
                echo "no CM needed for internal module"
                # patch to prep for the next version
                git tag v${version}
                git push --tags
                npm version patch --no-git-tag-version
                git config user.email "purecloud-jenkins@ininica.com"
                git config user.name "PureCloud Jenkins"
                git commit -am "Prep next version"
                git push origin HEAD:master
            """)
        }
    }
}
