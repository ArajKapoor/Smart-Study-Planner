# 🧠 Smart Study Planner

> **Ultimate Study Planner** — An intelligent, dynamic study timetable generator with Spaced Repetition, Active Recall, and Adaptive Rescheduling.

---

## 📋 Table of Contents

1. [About the Application](#about-the-application)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Running Locally](#running-locally)
5. [CI/CD Pipeline Overview](#cicd-pipeline-overview)
6. [Prerequisites & AWS Jenkins Setup](#prerequisites--aws-jenkins-setup)
7. [Jenkins Configuration](#jenkins-configuration)
8. [Docker Image Tagging & Publishing](#docker-image-tagging--publishing)
9. [Kubernetes Deployment](#kubernetes-deployment)
10. [Accessing the Deployed App](#accessing-the-deployed-app)
11. [Second-Run Demonstration](#second-run-demonstration)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [CCA 2 Submission Checklist](#cca-2-submission-checklist)

---

## About the Application

Smart Study Planner is a **client-side web application** that generates intelligent study schedules. Key features include:

- **Spaced Repetition Engine** — Automatically schedules review sessions 1 and 3 days after a subject is first studied to maximize memory retention.
- **Active Recall Cues** — Every 4th study block for a subject is flagged as a Quiz/Self-Testing session.
- **Adaptive Rescheduling** — Click "Mark Incomplete" on any missed block and the algorithm instantly redistributes remaining hours.
- **Conflict Resolution** — Add fixed commitments (labs, classes) and the scheduler wraps study sessions around them.
- **Configurable Techniques** — Pomodoro (25/5), Deep Work (50/10), or Custom (90/20) study blocks.
- **Print-Ready Output** — Built-in print stylesheet for physical copies.

---

## Technology Stack

| Component     | Technology                     |
|---------------|--------------------------------|
| Frontend      | HTML5, CSS3, Vanilla JavaScript |
| Fonts         | Google Fonts (Outfit)          |
| Database      | None (client-side state only)  |
| Backend       | None (static site)             |
| Web Server    | Nginx 1.27 (Docker container)  |
| Containerization | Docker                      |
| CI/CD         | Jenkins (Declarative Pipeline) |
| Orchestration | Kubernetes (Minikube)          |
| Registry      | Docker Hub                     |

---

## Project Structure

```
Smart-Study-Planner/
├── index.html          # Main HTML page (application entry point)
├── style.css           # Application styles (glassmorphism, animations)
├── script.js           # Application logic (scheduling algorithm)
├── nginx.conf          # Nginx server configuration (health checks, caching)
├── Dockerfile          # Container image definition (Nginx Alpine)
├── Jenkinsfile         # CI/CD pipeline definition (6 stages)
├── .gitignore          # Git exclusion rules
├── .dockerignore       # Docker build exclusion rules
├── k8s/
│   ├── deployment.yaml # Kubernetes Deployment (2 replicas, probes)
│   └── service.yaml    # Kubernetes Service (NodePort 30080)
└── README.md           # This documentation
```

### File Purposes

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds an Nginx Alpine image containing the static app files. Includes a health check. |
| `nginx.conf` | Custom Nginx config with `/healthz` endpoint for K8s probes, security headers, static asset caching. |
| `Jenkinsfile` | 6-stage declarative pipeline: Checkout → Build & Test → Docker Build → Docker Push → K8s Deploy → Verification. |
| `k8s/deployment.yaml` | Kubernetes Deployment with 2 replicas, RollingUpdate strategy, readiness/liveness probes, resource limits. |
| `k8s/service.yaml` | NodePort Service exposing the app on port 30080 for Minikube access. |

---

## Running Locally

### Option 1: Open Directly in Browser
```bash
# Simply open index.html in any modern browser
# On Windows:
start index.html

# On macOS:
open index.html

# On Linux:
xdg-open index.html
```

### Option 2: Run with Docker
```bash
# Build the image
docker build -t smart-study-planner:local .

# Run the container
docker run -d -p 8080:80 --name study-planner smart-study-planner:local

# Open in browser
# Visit http://localhost:8080

# Stop and remove
docker rm -f study-planner
```

---

## CI/CD Pipeline Overview

The Jenkins pipeline automates the complete build → test → containerize → deploy workflow:

```
┌──────────┐    ┌────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│ Checkout │───▶│ Build/Test  │───▶│ Docker Build  │───▶│ Docker Push │───▶│ K8s Deploy      │───▶│ Deploy Verification  │
│          │    │             │    │               │    │             │    │                 │    │                      │
│ Git pull │    │ HTML valid. │    │ Build image   │    │ Push to     │    │ Apply manifests │    │ Check pods/svc       │
│ Get SHA  │    │ CSS check   │    │ Tag: SHA +    │    │ Docker Hub  │    │ Wait rollout    │    │ Port-forward test    │
│          │    │ JS syntax   │    │ latest        │    │             │    │                 │    │ HTTP smoke test      │
│          │    │ Structure   │    │ Smoke test    │    │             │    │                 │    │                      │
└──────────┘    └────────────┘    └──────────────┘    └─────────────┘    └─────────────────┘    └──────────────────────┘
```

### What Each Stage Does

1. **Checkout** — Pulls the latest code from GitHub; extracts the short Git commit SHA for image tagging.
2. **Build & Test** — Validates that `index.html`, `style.css`, and `script.js` exist and are well-formed. Runs `node --check script.js` for JavaScript syntax validation. Verifies HTML structure (DOCTYPE, meta tags, linked assets, title).
3. **Docker Build** — Builds the Nginx-based Docker image tagged with both the commit SHA and `latest`. Runs a container smoke test to verify the image serves the app correctly.
4. **Docker Push** — Authenticates to Docker Hub using Jenkins credentials and pushes both tags.
5. **Deploy to Kubernetes** — Injects the commit-specific image tag into the deployment manifest via `sed`, applies both K8s manifests, and waits for the rollout to complete.
6. **Deployment Verification** — Verifies running pods, deployment status, and service status. Performs a port-forward HTTP smoke test to confirm the app is accessible and serving the correct content.

---

## Prerequisites & AWS Jenkins Setup

### AWS EC2 Instance Requirements
- **OS**: Ubuntu 22.04 LTS or newer (recommended)
- **Instance Type**: c7i-flex.large (free-tier eligible, 2 vCPU, 4 GB RAM) or t3.medium. Minikube needs ≥2 CPUs and ≥2 GB RAM, so t3.micro is too small
- **Storage**: ≥20 GB
- **Security Group**: Open ports 8080 (Jenkins UI), 22 (SSH)

### Install Required Tools on the AWS Server

Run these commands **on the AWS EC2 instance** via SSH:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Java (Jenkins prerequisite)
sudo apt install -y fontconfig openjdk-21-jre-headless

# 3. Install Jenkins
sudo curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key -o /usr/share/keyrings/jenkins-keyring.asc
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install -y jenkins
sudo systemctl enable --now jenkins

# 4. Install Docker
sudo apt install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker jenkins
sudo usermod -aG docker $USER

# 5. Install Node.js (for JS syntax checking in pipeline)
sudo apt install -y nodejs

# 6. Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 7. Install Minikube
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# 8. Start Minikube as the jenkins user (-H sets the jenkins home directory)
sudo -u jenkins -H minikube start --driver=docker --cpus=2 --memory=2200mb

# 9. Restart Jenkins to pick up Docker group membership
sudo systemctl restart jenkins
```

> **Important:** Minikube must be started by the same user that Jenkins runs as (typically `jenkins`). If Minikube was started by your SSH user, Jenkins won't have access to the kubeconfig.

### Verify Installations
```bash
# Run these as the jenkins user
sudo -u jenkins -H docker --version
sudo -u jenkins -H kubectl version --client
sudo -u jenkins -H minikube status
sudo -u jenkins -H node --version
sudo -u jenkins -H kubectl get nodes
```

---

## Jenkins Configuration

### Required Jenkins Plugins

Install these from **Jenkins → Manage Jenkins → Plugin Manager → Available**:

| Plugin | Purpose |
|--------|---------|
| **Pipeline** | Core declarative pipeline support |
| **Git** | Git SCM integration |
| **Pipeline: Stage View** | Visual pipeline stage display |
| **Docker Pipeline** | Docker integration in pipelines |
| **Credentials Binding** | Secure credential injection |
| **Timestamps** | Add timestamps to console output |
| **NodeJS** (optional) | If `node` is not globally available |

### Create Docker Hub Credentials

When Jenkins is installed (in Phase 4), create the credentials for Docker Hub access:

1. Navigate to **Jenkins Dashboard → Manage Jenkins → Credentials → System → Global credentials (unrestricted)**
2. Click **Add Credentials**
3. Configure the credential fields:
   - **Kind**: `Username with password`
   - **Scope**: `Global (Jenkins, nodes, items, all child items, etc.)`
   - **Username**: `arajkap07` (Your Docker ID)
   - **Password**: Your Docker Hub Personal Access Token (PAT) with `Read, Write, Delete` permissions (generate from **Docker Hub → Account Settings → Security → New Access Token**)
   - **ID**: `dockerhub-credentials` (Must match `REGISTRY_CRED_ID` in `Jenkinsfile`)
   - **Description**: `Docker Hub authentication for arajkap07/smart-study-planner`
4. Click **Create**

### Create the Pipeline Job

1. Go to **Jenkins Dashboard → New Item**
2. Enter item name: `Smart-Study-Planner`
3. Select **Pipeline** and click **OK**
4. Under the **Pipeline** configuration section:
   - **Definition**: Pipeline script from SCM
   - **SCM**: Git
   - **Repository URL**: `https://github.com/ArajKapoor/Smart-Study-Planner.git`
   - **Branch Specifier**: `*/main`
   - **Script Path**: `Jenkinsfile`
5. Under **Build Triggers**:
   - ✅ **GitHub hook trigger for GITScm polling** (when GitHub webhook is configured)
   - ✅ **Poll SCM**: `H/5 * * * *` (fallback periodic poll every 5 minutes)
6. Click **Save**

### Configure GitHub Webhook (Optional / Recommended)

1. Navigate to GitHub repository: **Settings → Webhooks → Add webhook**
2. Set:
   - **Payload URL**: `http://<your-jenkins-ip>:8080/github-webhook/`
   - **Content type**: `application/json`
   - **Events**: Just the `push` event
3. Ensure the security group allows inbound traffic on port 8080.

---

## Docker Image Tagging & Publishing

Each pipeline run produces two Docker image tags:

| Tag | Example | Purpose |
|-----|---------|---------|
| `<commit-sha>` | `arajkap07/smart-study-planner:bc00fb5` | Unique, immutable tag tied to a specific Git commit SHA |
| `latest` | `arajkap07/smart-study-planner:latest` | Convenience tag pointing to the most recent build |

The commit SHA tag ensures that:
- Every code change produces a **distinct, immutable image**
- Kubernetes detects the tag change and triggers a **rolling update**
- You can **trace any deployed version** back to its exact Git commit

### Public vs. Private Repository & `imagePullSecrets`

* **Public Repository (Default)**: If `arajkap07/smart-study-planner` is public on Docker Hub, Minikube and Kubernetes pull images anonymously without any cluster credentials.
* **Private Repository**: If you configure the repository as private on Docker Hub, Kubernetes requires an `imagePullSecret` to pull images:
  1. Create the secret in your Kubernetes cluster:
     ```bash
     kubectl create secret docker-registry dockerhub-pull-secret \
       --docker-server=https://index.docker.io/v1/ \
       --docker-username=arajkap07 \
       --docker-password=<your-dockerhub-access-token> \
       --docker-email=<your-email>
     ```
  2. Uncomment the `imagePullSecrets` block in `k8s/deployment.yaml`:
     ```yaml
     spec:
       imagePullSecrets:
         - name: dockerhub-pull-secret
       containers:
         - name: smart-study-planner
           image: IMAGE_PLACEHOLDER
     ```

---

## Kubernetes Deployment

### How Jenkins Deploys to Minikube

1. The pipeline uses `sed` to replace `IMAGE_PLACEHOLDER` in `k8s/deployment.yaml` with the actual commit-tagged image name.
2. `kubectl apply` creates or updates both the Deployment and Service.
3. `kubectl rollout status` waits for all pods to become ready (timeout: 120 seconds).
4. The verification stage confirms pods are running and the app responds to HTTP requests.

### Inspect the Deployment

Run these commands **on the AWS server**:

```bash
# Check deployment status
kubectl get deployment smart-study-planner -o wide

# Check running pods
kubectl get pods -l app=smart-study-planner -o wide

# Check service
kubectl get service smart-study-planner-service -o wide

# Describe deployment for detailed info
kubectl describe deployment smart-study-planner

# View pod logs
kubectl logs -l app=smart-study-planner --tail=50

# Check which image version is deployed
kubectl get deployment smart-study-planner -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Deployment Architecture

```
                    ┌─────────────────────────────────────┐
                    │        Minikube Cluster              │
                    │                                     │
                    │  ┌──────────────────────────────┐   │
                    │  │ Service: NodePort 30080       │   │
                    │  │   (smart-study-planner-svc)   │   │
                    │  └──────────┬───────────────────┘   │
                    │             │                       │
                    │     ┌───────┴───────┐               │
                    │     │               │               │
                    │  ┌──▼──┐        ┌──▼──┐            │
                    │  │Pod 1│        │Pod 2│            │
                    │  │:80  │        │:80  │            │
                    │  └─────┘        └─────┘            │
                    │  (Nginx)        (Nginx)             │
                    │                                     │
                    └─────────────────────────────────────┘
```

---

## Accessing the Deployed App

### On the AWS Server

```bash
# Method 1: Use Minikube service command (opens browser or shows URL)
minikube service smart-study-planner-service --url

# Method 2: Get the NodePort URL manually
echo "http://$(minikube ip):30080"

# Method 3: Port-forward for direct access
kubectl port-forward service/smart-study-planner-service 8080:80
# Then visit http://localhost:8080
```

### Verify the App is Working

```bash
# Quick health check
curl http://$(minikube ip):30080/healthz

# Check the main page loads
curl -s http://$(minikube ip):30080/ | grep "Ultimate Study Planner"
```

---

## Second-Run Demonstration

This section demonstrates that a **code change → push → pipeline run → deployment update** works correctly.

### Step 1: Make a Visible Source Code Change

Edit `index.html` and add a version indicator in the header. Change line 20:

**Before:**
```html
<p>Spaced Repetition • Active Recall • Adaptive Rescheduling</p>
```

**After:**
```html
<p>Spaced Repetition • Active Recall • Adaptive Rescheduling • v2.0</p>
```

### Step 2: Commit and Push

```bash
git add -A
git commit -m "feat: add version indicator for CCA2 second-run demo"
git push origin main
```

### Step 3: Trigger Jenkins Pipeline

- **If GitHub webhook is configured**: The push automatically triggers the pipeline.
- **If using Poll SCM**: Wait up to 5 minutes, or manually click **"Build Now"** in Jenkins.

### Step 4: Verify the New Deployment

```bash
# 1. Check that a NEW image tag was pushed (different commit SHA)
kubectl get deployment smart-study-planner -o jsonpath='{.spec.template.spec.containers[0].image}'
# Should show the new commit SHA, e.g., arajkap07/smart-study-planner:a1b2c3d

# 2. Verify the rollout completed
kubectl rollout status deployment/smart-study-planner

# 3. Check the updated content
curl -s http://$(minikube ip):30080/ | grep "v2.0"
# Should find "v2.0" in the output
```

### Step 5: Take Screenshots For Submission

Capture:
1. Jenkins pipeline showing both runs (first and second) as successful.
2. Jenkins console output for the second run showing the new commit SHA.
3. Terminal showing `kubectl get pods` with the updated pods.
4. Browser showing the app with "v2.0" visible in the subtitle.

---

## Troubleshooting Guide

### Build & Test Failures

| Problem | Solution |
|---------|----------|
| `node --check script.js` fails | Ensure Node.js is installed on the Jenkins server: `sudo apt install -y nodejs` |
| "index.html is missing or empty" | Verify the Git checkout succeeded; check the workspace directory |

### Docker Build Failures

| Problem | Solution |
|---------|----------|
| "Cannot connect to Docker daemon" | Ensure Jenkins user is in the `docker` group: `sudo usermod -aG docker jenkins` then restart Jenkins |
| "Permission denied" on Docker socket | Run: `sudo chmod 666 /var/run/docker.sock` (temporary) or add jenkins to docker group (permanent) |
| Image build times out | Check internet connectivity (Nginx Alpine image download) |

### Docker Push / Registry Failures

| Problem | Solution |
|---------|----------|
| "denied: requested access to the resource is denied" | Verify `dockerhub-credentials` ID in Jenkins matches the Jenkinsfile. Ensure the Docker Hub username in `DOCKER_HUB_REPO` is correct |
| "unauthorized: authentication required" | Re-create the credential in Jenkins with correct username/password |
| Repository doesn't exist on Docker Hub | Create the repository `smart-study-planner` on Docker Hub first, or Docker Hub will auto-create on first push if using a personal account |

### Kubernetes / Minikube Failures

| Problem | Solution |
|---------|----------|
| "The connection to the server localhost:8080 was refused" | Minikube isn't running or kubeconfig is wrong. Run: `sudo -u jenkins minikube start --driver=docker` |
| "error: unable to connect to the server" | Ensure Minikube was started by the `jenkins` user, not your SSH user |
| Pods in `ImagePullBackOff` | The Docker image wasn't pushed successfully, or the image name is wrong. Check: `kubectl describe pod <pod-name>` |
| Pods in `CrashLoopBackOff` | Check pod logs: `kubectl logs <pod-name>`. Verify Nginx config is valid |
| "rollout status" times out | Describe the deployment: `kubectl describe deployment smart-study-planner`. Check pod events for errors |
| NodePort not accessible | Check Minikube IP: `minikube ip`. Verify the service: `kubectl get svc smart-study-planner-service` |
| Port 30080 already in use | Change `nodePort` in `k8s/service.yaml` to another port (30000-32767 range) |

### Networking Failures

| Problem | Solution |
|---------|----------|
| Cannot access Jenkins UI | Check AWS Security Group allows inbound on port 8080 |
| GitHub webhook not triggering | Verify the webhook URL, check the Webhooks page in GitHub for delivery status |
| Minikube service URL not accessible remotely | Minikube runs locally; use SSH tunnel: `ssh -L 30080:<minikube-ip>:30080 user@aws-server` |

---

## CCA 2 Submission Checklist

### Required Screenshots

- [ ] **1.** GitHub repository showing all project files (Dockerfile, Jenkinsfile, k8s/, etc.)
- [ ] **2.** Jenkins Dashboard showing the pipeline job
- [ ] **3.** Jenkins pipeline — **first run** — all 6 stages green (Stage View)
- [ ] **4.** Jenkins console output — Checkout stage (showing commit SHA)
- [ ] **5.** Jenkins console output — Build & Test stage (showing passed validations)
- [ ] **6.** Jenkins console output — Docker Build stage (showing image build + smoke test)
- [ ] **7.** Jenkins console output — Docker Push stage (showing successful push)
- [ ] **8.** Jenkins console output — Deploy to Kubernetes stage (showing rollout success)
- [ ] **9.** Jenkins console output — Deployment Verification stage (showing pod status + HTTP test)
- [ ] **10.** Docker Hub showing the pushed image with commit SHA tag
- [ ] **11.** Terminal: `kubectl get deployments` output
- [ ] **12.** Terminal: `kubectl get pods` output showing Running pods
- [ ] **13.** Terminal: `kubectl get services` output showing NodePort
- [ ] **14.** Browser: Application running and accessible via Minikube
- [ ] **15.** Source code change for second run (the `v2.0` edit in `index.html`)
- [ ] **16.** Jenkins pipeline — **second run** — all stages green
- [ ] **17.** Docker Hub showing the **new** commit SHA tag from second run
- [ ] **18.** Terminal: `kubectl get pods` showing updated pods after second run
- [ ] **19.** Browser: Updated application showing "v2.0" after second deployment
- [ ] **20.** Terminal: `kubectl describe deployment` showing new image tag

### Deliverable Files

- [ ] `Dockerfile` — Application containerization
- [ ] `nginx.conf` — Web server configuration
- [ ] `Jenkinsfile` — CI/CD pipeline definition
- [ ] `k8s/deployment.yaml` — Kubernetes Deployment manifest
- [ ] `k8s/service.yaml` — Kubernetes Service manifest
- [ ] `.gitignore` — Git exclusion rules
- [ ] `.dockerignore` — Docker build exclusion rules
- [ ] `README.md` — Project and CI/CD documentation

---

## Original Application Features

### Web App
1. Open `index.html` in any modern web browser.
2. Configure your global preferences, add subjects, and set their priority (Weak, Medium, Strong).
3. Click **Generate Smart Schedule** and follow your dynamic timeline!

### Core Algorithm Features
- **Spaced Repetition Engine** — Reviews at day+1 and day+3 intervals.
- **Active Recall** — Every 4th session per subject becomes a quiz.
- **Adaptive Rescheduling** — "Mark Incomplete" redistributes remaining study time.
- **Conflict Resolution** — Fixed events (labs, classes) are respected.
- **Multiple Techniques** — Pomodoro, Deep Work, or Custom study blocks.
- **Print Support** — Clean print stylesheet for physical schedules.
