pipeline {
    agent any

    environment {
        DOCKER_HUB_REPO  = 'arajkap07/smart-study-planner'
        REGISTRY_CRED_ID = 'dockerhub-credentials'
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG     = "${env.DOCKER_HUB_REPO}:${env.GIT_SHORT_SHA}"
                    env.IMAGE_LATEST  = "${env.DOCKER_HUB_REPO}:latest"
                    echo "Git Commit  : ${env.GIT_SHORT_SHA}"
                    echo "Image Tag   : ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build & Test') {
            steps {
                echo '── Validating HTML ──'
                sh '''
                    echo "Checking index.html exists and is non-empty..."
                    test -s index.html || { echo "ERROR: index.html is missing or empty"; exit 1; }
                '''

                echo '── Validating CSS ──'
                sh '''
                    echo "Checking style.css exists and is non-empty..."
                    test -s style.css || { echo "ERROR: style.css is missing or empty"; exit 1; }
                '''

                echo '── Validating JavaScript syntax ──'
                sh '''
                    echo "Checking script.js syntax with Node.js..."
                    node --check script.js
                '''

                echo '── Running HTML structure tests ──'
                sh '''
                    echo "Verifying required HTML elements..."

                    grep -qi "<!DOCTYPE html>" index.html || { echo "ERROR: Missing DOCTYPE"; exit 1; }

                    grep -qi '<meta charset' index.html || { echo "ERROR: Missing charset meta tag"; exit 1; }
                    grep -qi '<meta name="viewport"' index.html || { echo "ERROR: Missing viewport meta tag"; exit 1; }

                    grep -qi 'style.css' index.html || { echo "ERROR: style.css not linked in index.html"; exit 1; }
                    grep -qi 'script.js' index.html || { echo "ERROR: script.js not linked in index.html"; exit 1; }

                    grep -qi '<title>' index.html || { echo "ERROR: Missing <title> tag"; exit 1; }

                    echo "All HTML structure tests passed."
                '''

                echo '── Build & Test stage PASSED ──'
            }
        }

        stage('Docker Build') {
            steps {
                echo "Building Docker image: ${env.IMAGE_TAG}"
                sh """
                    docker build -t ${env.IMAGE_TAG} -t ${env.IMAGE_LATEST} .
                """

                echo '── Running container smoke test ──'
                sh '''
                    docker run -d --name smoke-test -p 8888:80 ${IMAGE_TAG}

                    sleep 3

                    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/healthz)
                    echo "Health check HTTP status: ${HTTP_STATUS}"

                    PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/)
                    echo "Main page HTTP status: ${PAGE_STATUS}"

                    curl -s http://localhost:8888/ | grep -q "Ultimate Study Planner" || {
                        echo "ERROR: Page content verification failed"
                        docker logs smoke-test
                        docker rm -f smoke-test
                        exit 1
                    }
                    echo "Content verification passed."

                    docker rm -f smoke-test

                    if [ "${HTTP_STATUS}" != "200" ] || [ "${PAGE_STATUS}" != "200" ]; then
                        echo "ERROR: Smoke test failed"
                        exit 1
                    fi

                    echo "Container smoke test PASSED."
                '''
            }
        }

        stage('Docker Push') {
            steps {
                echo "Pushing ${env.IMAGE_TAG} and ${env.IMAGE_LATEST} to Docker Hub..."
                withCredentials([usernamePassword(
                    credentialsId: "${env.REGISTRY_CRED_ID}",
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                        docker push ${IMAGE_TAG}
                        docker push ${IMAGE_LATEST}
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                echo "Deploying image ${env.IMAGE_TAG} to Minikube..."
                sh """
                    sed 's|IMAGE_PLACEHOLDER|${env.IMAGE_TAG}|g' k8s/deployment.yaml > k8s/deployment-live.yaml

                    if grep -q "IMAGE_PLACEHOLDER" k8s/deployment-live.yaml; then
                        echo "ERROR: Unresolved IMAGE_PLACEHOLDER in k8s/deployment-live.yaml"
                        exit 1
                    fi

                    echo "── Applying Kubernetes manifests ──"
                    kubectl apply -f k8s/deployment-live.yaml
                    kubectl apply -f k8s/service.yaml

                    echo "── Waiting for rollout to complete ──"
                    kubectl rollout status deployment/smart-study-planner --timeout=120s

                    rm -f k8s/deployment-live.yaml
                """
            }
        }

        stage('Deployment Verification') {
            steps {
                echo '── Checking Deployment Status ──'
                sh '''
                    echo "=== Deployment ==="
                    kubectl get deployment smart-study-planner -o wide

                    echo ""
                    echo "=== Pods ==="
                    kubectl get pods -l app=smart-study-planner -o wide

                    echo ""
                    echo "=== Service ==="
                    kubectl get service smart-study-planner-service -o wide

                    echo ""
                    echo "=== Pod Readiness ==="
                    READY_PODS=$(kubectl get pods -l app=smart-study-planner --field-selector=status.phase=Running --no-headers | wc -l)
                    echo "Ready pods: ${READY_PODS}"

                    if [ "${READY_PODS}" -lt 1 ]; then
                        echo "ERROR: No running pods found!"
                        kubectl describe pods -l app=smart-study-planner
                        exit 1
                    fi
                    echo "Pod readiness check PASSED."
                '''

                echo '── Running application accessibility test ──'
                sh '''
                    kubectl port-forward service/smart-study-planner-service 9090:80 &
                    PF_PID=$!

                    sleep 5

                    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/healthz)
                    echo "Health endpoint status: ${HTTP_STATUS}"

                    PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/)
                    echo "Main page status: ${PAGE_STATUS}"

                    curl -s http://localhost:9090/ | grep -q "Ultimate Study Planner" && echo "Content verification PASSED." || echo "WARNING: Content verification failed."

                    kill $PF_PID 2>/dev/null || true
                    wait $PF_PID 2>/dev/null || true

                    if [ "${HTTP_STATUS}" != "200" ] || [ "${PAGE_STATUS}" != "200" ]; then
                        echo "ERROR: Application accessibility test FAILED"
                        exit 1
                    fi

                    echo "Application accessibility test PASSED."
                '''
            }
        }
    }

    post {
        success {
            echo """
╔══════════════════════════════════════════════════════════╗
║           PIPELINE COMPLETED SUCCESSFULLY               ║
║                                                          ║
║  Image : ${env.IMAGE_TAG}                                ║
║  App   : Smart Study Planner                             ║
║  Access: minikube service smart-study-planner-service     ║
╚══════════════════════════════════════════════════════════╝
            """
        }
        failure {
            echo """
╔══════════════════════════════════════════════════════════╗
║               PIPELINE FAILED                            ║
║  Check the stage logs above for error details.           ║
╚══════════════════════════════════════════════════════════╝
            """
        }
        always {
            sh 'docker rm -f smoke-test 2>/dev/null || true'
        }
    }
}
