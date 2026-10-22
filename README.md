# Smart Study Planner

Ultimate Study Planner is a client-side web app that generates study timetables using spaced repetition, active recall and adaptive rescheduling. This repository also contains a complete CI/CD pipeline: GitHub, Jenkins on AWS EC2, Docker Hub and Kubernetes (Minikube).

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Web server | Nginx 1.27 (Alpine, Docker) |
| CI/CD | Jenkins (declarative pipeline) |
| Registry | Docker Hub |
| Orchestration | Kubernetes (Minikube) |
| Cloud | AWS EC2 (Ubuntu) |

## Project Structure

```
Smart-Study-Planner/
├── index.html
├── style.css
├── script.js
├── nginx.conf
├── Dockerfile
├── Jenkinsfile
├── .gitignore
├── .dockerignore
├── k8s/
│   ├── deployment.yaml
│   └── service.yaml
└── README.md
```

| File | Purpose |
|------|---------|
| `Dockerfile` | Nginx Alpine image with the static files and a health check |
| `nginx.conf` | Serves the site, adds the `/healthz` endpoint used by Kubernetes probes |
| `Jenkinsfile` | Six-stage pipeline |
| `k8s/deployment.yaml` | 2 replicas, rolling update, readiness and liveness probes |
| `k8s/service.yaml` | NodePort service on port 30080 |

## Run Locally

```bash
docker build -t smart-study-planner:local .
docker run -d -p 8080:80 --name study-planner smart-study-planner:local
```

Open `http://localhost:8080`. Remove it with `docker rm -f study-planner`.

## CI/CD Pipeline

```
Checkout -> Build & Test -> Docker Build -> Docker Push -> Deploy to Kubernetes -> Deployment Verification
```

1. **Checkout**: pulls the code and reads the short git commit SHA for the image tag.
2. **Build & Test**: checks the files exist, runs `node --check script.js`, and validates the HTML structure.
3. **Docker Build**: builds the image tagged with the commit SHA and `latest`, then runs a container smoke test.
4. **Docker Push**: logs in with Jenkins credentials and pushes both tags to Docker Hub.
5. **Deploy to Kubernetes**: replaces `IMAGE_PLACEHOLDER` with the new tag, applies both manifests and waits for the rollout.
6. **Deployment Verification**: checks pods and service, then runs an HTTP test through a port-forward.

## AWS Server Setup

Use an Ubuntu EC2 instance (c7i-flex.large or t3.medium, at least 2 vCPU, 4 GB RAM, 20 GB disk) with ports 22 and 8080 open in the security group. Run on the server:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y fontconfig openjdk-21-jre-headless

sudo curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key -o /usr/share/keyrings/jenkins-keyring.asc
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install -y jenkins
sudo systemctl enable --now jenkins

sudo apt install -y docker.io nodejs
sudo systemctl enable --now docker
sudo usermod -aG docker jenkins
sudo usermod -aG docker $USER

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

sudo -u jenkins -H minikube start --driver=docker --cpus=2 --memory=2200mb
sudo systemctl restart jenkins
```

Minikube must be started by the `jenkins` user, otherwise the pipeline cannot reach the cluster.

## Jenkins Configuration

1. Open `http://<server-ip>:8080`, unlock with `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`, and install the suggested plugins.
2. Add a Docker Hub credential: **Manage Jenkins, Credentials, Global, Add Credentials**. Kind `Username with password`, username `arajkap07`, password a Docker Hub access token, ID `dockerhub-credentials`.
3. Create the job: **New Item**, name `Smart-Study-Planner`, type **Pipeline**. Set **Pipeline script from SCM**, Git, repository `https://github.com/ArajKapoor/Smart-Study-Planner.git`, branch `*/main`, script path `Jenkinsfile`.
4. Save, then click **Build Now**.

## Image Tags

Each build pushes two tags to `arajkap07/smart-study-planner`:

| Tag | Purpose |
|-----|---------|
| `<commit-sha>` | Unique tag tied to one git commit, so every deployed version can be traced |
| `latest` | Always points to the newest build |

The changing tag is what makes Kubernetes perform a rolling update on each build.

## Access the Deployed App

On the server:

```bash
sudo -u jenkins -H kubectl get pods
sudo -u jenkins -H kubectl get svc
sudo -u jenkins -H minikube ip
curl http://$(sudo -u jenkins -H minikube ip):30080/healthz
```

From your laptop, open an SSH tunnel to Minikube and browse `http://localhost:30080`:

```powershell
ssh -i $HOME\.ssh\study-key.pem -L 30080:192.168.49.2:30080 ubuntu@SERVER_PUBLIC_IP
```

Use the real Minikube IP from the `minikube ip` command.

## Second-Run Demonstration

Change line 20 of `index.html` to add a version label, then push:

```html
<p>Spaced Repetition • Active Recall • Adaptive Rescheduling • v2.0</p>
```

```bash
git add index.html
git commit -m "feat: add v2.0 label to header"
git push origin main
```

Click **Build Now** in Jenkins. When the build is green, refresh the app and the new label appears. Docker Hub shows a new commit tag, and `kubectl get pods` shows freshly created pods.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `node --check` fails | `sudo apt install -y nodejs` |
| Docker permission denied | `sudo usermod -aG docker jenkins`, then `sudo systemctl restart jenkins` |
| `docker run requires at least 1 argument` | An empty `IMAGE_TAG`. Do not set empty defaults in the Jenkinsfile `environment` block |
| Push denied or unauthorized | Check the `dockerhub-credentials` ID, username and token |
| Connection to localhost:8080 refused | Start Minikube as the jenkins user: `sudo -u jenkins -H minikube start --driver=docker` |
| `ImagePullBackOff` | Check the image name and that the push succeeded |
| `CrashLoopBackOff` | `kubectl logs <pod-name>` |
| App not reachable | Check `minikube ip`, `kubectl get svc`, and that the SSH tunnel is open |

## Submission Checklist

- [ ] GitHub repository showing all files
- [ ] Jenkins job with all six stages green (first run)
- [ ] Console output of the Docker Push and Deploy stages
- [ ] Docker Hub tags page
- [ ] `kubectl get pods` and `kubectl get svc`
- [ ] App running in the browser
- [ ] Code change for the second run
- [ ] Second run green, new Docker Hub tag, updated pods and updated page
