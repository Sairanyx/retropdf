# deploy/

The production setup: the app in one container, Caddy in front for HTTPS.
Full steps are in [DEPLOYMENT.md](../DEPLOYMENT.md).

| File | What it does |
|---|---|
| `Dockerfile` | Builds the app image. Non-root, no access log |
| `compose.yml` | Runs the app and Caddy together, keeps the counter in a volume |
| `Caddyfile` | HTTPS certificates, `www` redirect, compression. Logs off |
| `.env.example` | Copy to `.env` and set the domain. `.env` is never committed |
