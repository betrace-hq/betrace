# Integrating BeTrace Plugin with Grafana Helm Chart

This guide shows how to add the BeTrace Grafana plugin to an existing [official Grafana Helm chart](https://github.com/grafana/helm-charts/tree/main/charts/grafana) deployment.

## Method 1: Init Container (Recommended)

Use the BeTrace plugin init container to copy plugin files at startup.

### Step 1: Create values.yaml

```yaml
# grafana-with-betrace.yaml

# BeTrace plugin installation via init container
extraInitContainers:
  - name: install-betrace-plugin
    image: ghcr.io/betracehq/betrace/plugin-init:latest
    imagePullPolicy: IfNotPresent
    command: ["sh", "-c", "cp -r /plugin /grafana-plugins/betrace-app"]
    volumeMounts:
      - name: plugins
        mountPath: /grafana-plugins

# Mount plugins volume into Grafana
extraVolumeMounts:
  - name: plugins
    mountPath: /var/lib/grafana/plugins

# Create plugins volume
extraVolumes:
  - name: plugins
    emptyDir: {}

# Allow unsigned plugins (required for BeTrace)
env:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "betrace-app"

# Configure BeTrace backend datasource
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: BeTrace Backend
        type: prometheus  # Adjust based on backend API type
        url: http://betrace-backend:8080
        access: proxy
        isDefault: false
      - name: Tempo
        type: tempo
        url: http://tempo:3200
        access: proxy
        uid: tempo
      - name: Loki
        type: loki
        url: http://loki:3100
        access: proxy
        uid: loki

# Security settings (change in production!)
adminUser: admin
adminPassword: admin

# Persistence
persistence:
  enabled: true
  size: 10Gi
```

### Step 2: Install Grafana

```bash
# Add Grafana Helm repository
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Grafana with BeTrace plugin
helm install grafana grafana/grafana \
  --namespace observability \
  --create-namespace \
  -f grafana-with-betrace.yaml
```

### Step 3: Access Grafana

```bash
# Port-forward to Grafana
kubectl port-forward -n observability svc/grafana 3000:80

# Open browser
open http://localhost:3000

# Login: admin/admin (change immediately!)
```

### Step 4: Verify Plugin

1. Navigate to **Configuration → Plugins**
2. Search for "BeTrace"
3. Plugin should appear with status "Enabled"
4. Access via **Apps → BeTrace** in sidebar

## Method 2: Persistent Volume with Pre-Loaded Plugin

For production, pre-load the plugin into a persistent volume.

### Step 1: Create Plugin PVC

```yaml
# betrace-plugin-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: betrace-plugin-pvc
  namespace: observability
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f betrace-plugin-pvc.yaml
```

### Step 2: Load Plugin into PVC

```bash
# Run job to copy plugin
kubectl run betrace-plugin-loader \
  --image=ghcr.io/betracehq/betrace/plugin-init:latest \
  --restart=Never \
  --namespace=observability \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "betrace-plugin-loader",
      "image": "ghcr.io/betracehq/betrace/plugin-init:latest",
      "command": ["sh", "-c", "cp -r /plugin /mnt/plugins/betrace-app && echo Done"],
      "volumeMounts": [{
        "name": "plugins",
        "mountPath": "/mnt/plugins"
      }]
    }],
    "volumes": [{
      "name": "plugins",
      "persistentVolumeClaim": {
        "claimName": "betrace-plugin-pvc"
      }
    }]
  }
}'

# Wait for completion
kubectl wait --for=condition=complete -n observability pod/betrace-plugin-loader --timeout=60s

# Clean up
kubectl delete pod betrace-plugin-loader -n observability
```

### Step 3: Mount PVC in Grafana

```yaml
# grafana-values.yaml (updated)

extraVolumeMounts:
  - name: betrace-plugin
    mountPath: /var/lib/grafana/plugins/betrace-app

extraVolumes:
  - name: betrace-plugin
    persistentVolumeClaim:
      claimName: betrace-plugin-pvc

env:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "betrace-app"
```

```bash
# Upgrade Grafana
helm upgrade grafana grafana/grafana \
  -n observability \
  -f grafana-values.yaml
```

## Method 3: ConfigMap with Plugin Files

For small plugins, use ConfigMap (not recommended for large plugins).

### Step 1: Build Plugin Locally

```bash
cd grafana-betrace-app
npm install
npm run build
```

### Step 2: Create ConfigMap

```bash
kubectl create configmap betrace-plugin \
  --from-file=dist/ \
  --namespace=observability
```

### Step 3: Mount ConfigMap

```yaml
# grafana-values.yaml

extraVolumeMounts:
  - name: betrace-plugin
    mountPath: /var/lib/grafana/plugins/betrace-app

extraVolumes:
  - name: betrace-plugin
    configMap:
      name: betrace-plugin

env:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "betrace-app"
```

## Troubleshooting

### Plugin Not Appearing

**Check unsigned plugins environment variable:**
```bash
kubectl exec -n observability deployment/grafana -- env | grep UNSIGNED
```

Expected output:
```
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app
```

**Verify plugin files exist:**
```bash
kubectl exec -n observability deployment/grafana -- ls -la /var/lib/grafana/plugins
```

Should show `betrace-app` directory.

**Check Grafana logs:**
```bash
kubectl logs -n observability deployment/grafana | grep -i plugin
```

### Init Container Failing

**Check init container logs:**
```bash
POD=$(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n observability $POD -c install-betrace-plugin
```

**Verify plugin image exists:**
```bash
docker pull ghcr.io/betracehq/betrace/plugin-init:latest
```

### Backend Connection Issues

**Test backend connectivity from Grafana pod:**
```bash
kubectl exec -n observability deployment/grafana -- \
  curl -v http://betrace-backend:8080/health
```

**Check datasource configuration:**
```bash
kubectl exec -n observability deployment/grafana -- \
  cat /etc/grafana/provisioning/datasources/datasources.yaml
```

## Production Recommendations

1. **Pin Image Versions**
   ```yaml
   extraInitContainers:
     - name: install-betrace-plugin
       image: ghcr.io/betracehq/betrace/plugin-init:v2.0.0  # Not :latest
   ```

2. **Use Persistent Volume Method**
   - Faster pod restarts (no init container delay)
   - Better for high-availability deployments
   - Plugin survives Grafana upgrades

3. **Security**
   ```yaml
   adminPassword: "${GRAFANA_ADMIN_PASSWORD}"  # From secret

   env:
     GF_SECURITY_ADMIN_PASSWORD:
       valueFrom:
         secretKeyRef:
           name: grafana-admin
           key: password
   ```

4. **Resource Limits**
   ```yaml
   resources:
     limits:
       cpu: 500m
       memory: 512Mi
     requests:
       cpu: 100m
       memory: 128Mi
   ```

5. **High Availability**
   ```yaml
   replicas: 3

   affinity:
     podAntiAffinity:
       requiredDuringSchedulingIgnoredDuringExecution:
         - labelSelector:
             matchExpressions:
               - key: app.kubernetes.io/name
                 operator: In
                 values:
                   - grafana
           topologyKey: kubernetes.io/hostname
   ```

## Complete Example

```yaml
# production-grafana.yaml

# Plugin installation
extraInitContainers:
  - name: install-betrace-plugin
    image: ghcr.io/betracehq/betrace/plugin-init:v2.0.0
    imagePullPolicy: IfNotPresent
    command: ["sh", "-c", "cp -r /plugin /grafana-plugins/betrace-app"]
    volumeMounts:
      - name: plugins
        mountPath: /grafana-plugins

extraVolumeMounts:
  - name: plugins
    mountPath: /var/lib/grafana/plugins

extraVolumes:
  - name: plugins
    emptyDir: {}

# Security
adminUser: admin
adminPassword: "${GRAFANA_ADMIN_PASSWORD}"

env:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "betrace-app"
  GF_SECURITY_ADMIN_PASSWORD:
    valueFrom:
      secretKeyRef:
        name: grafana-admin
        key: password

# Datasources
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: Tempo
        type: tempo
        url: http://tempo:3200
        access: proxy
        uid: tempo
      - name: Loki
        type: loki
        url: http://loki:3100
        access: proxy
        uid: loki

# Persistence
persistence:
  enabled: true
  storageClassName: fast-ssd
  size: 50Gi

# HA Configuration
replicas: 3

affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app.kubernetes.io/name
              operator: In
              values:
                - grafana
        topologyKey: kubernetes.io/hostname

# Resources
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 200m
    memory: 256Mi

# Ingress
ingress:
  enabled: true
  ingressClassName: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - grafana.example.com
  tls:
    - secretName: grafana-tls
      hosts:
        - grafana.example.com
```

## See Also

- [BeTrace Helm Chart](../helm/betrace/README.md) - Standalone BeTrace deployment
- [Docker Compose Quick Start](../docker/README.md) - Local testing
- [Official Grafana Helm Chart](https://github.com/grafana/helm-charts/tree/main/charts/grafana)
- [Grafana Plugin Management](https://grafana.com/docs/grafana/latest/administration/plugin-management/)
