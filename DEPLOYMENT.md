# Deployment

One container for the app, Caddy in front for HTTPS, on one small VM. The
server only hands out pages, so the smallest plan of most hosts is enough.

## You need

- A VM in the EU (the privacy page names the host and its country), with
  Docker and the compose plugin.
- A domain with two A records pointing at the VM: `@` and `www`.
- Ports 80 and 443 open. Caddy needs port 80 to get the certificate.

Point the domain **before** the first start: Caddy asks for the certificate
straight away and fails if the name does not resolve yet.

## First deploy

```bash
git clone https://github.com/Sairanyx/retropdf.git
cd retropdf/deploy
cp .env.example .env          # set RETROPDF_DOMAIN to the real domain
docker compose up -d --build
docker compose logs -f caddy  # watch the certificate arrive
```

`.env` is the only file naming the real server. It is gitignored.

## Check it before telling anyone

```bash
D=https://your-domain

# The header the privacy claim rests on.
curl -sI $D | grep -i content-security-policy

# Links must be absolute and on the real domain.
curl -s $D | grep -E 'canonical|og:image'

# www. must redirect to the plain address.
curl -sI https://www.your-domain | grep -i location

# Every tool, in a real browser, against the live site.
BASE=$D npm run test:e2e

# Nothing about visitors may be written anywhere.
docker compose logs --tail 50 app caddy
```

The last one should show startup and certificate messages only: no visitor
addresses, no request lines. Then open the site, pick a PDF, and watch the
Network tab while a tool runs. Nothing should leave.

## Update

```bash
git pull
docker compose up -d --build
```

The desktop app count lives in the `count` volume, so it survives this.
Back it up now and then: it is the one thing the server keeps.

```bash
docker compose cp app:/data/interest.count ./interest.count.backup
```

## Logs are off

Both servers: `log { output discard }` in the Caddyfile and `--no-access-log`
in the Dockerfile. Docker keeps whatever a container prints, so either one
logging would put visitor addresses on disk. If you turn logging on, change
the privacy page.

## Hardening

The risk that matters: anyone who can write to the server can serve
different JavaScript that sends files away. So nobody gets write access.

- SSH keys only; password login off.
- Firewall: 80 and 443 open, SSH limited to your address if you can.
- Nothing else on the VM.
- Unattended security updates on.
- Two factor on the registrar, the host and GitHub. A poisoned push is a
  poisoned deploy.

## Before going live

- [ ] The contact address (`CONTACT_EMAIL` in `app/main.py`) exists and
      reaches you. The privacy and security pages give it as the contact.
- [x] The privacy page names the hosting company and the server's country
      (`privacy.host` in the translations: OVHcloud, Poland).
- [ ] Read the privacy, terms and security pages once as a stranger would.
