# Deployment

The site is one container behind Caddy, on a single small VM. The server does
no work beyond handing out pages, so the free tier of most hosts is enough.

> **Not yet run in production.** The configuration in `deploy/` is written but
> has not been built or deployed. Expect the first run to need corrections,
> and update this file as it does.

## What you need

- A VM with a public address. A free or cheap tier is enough, since the
  server only hands out pages.
- A domain pointed at it, with an A record for both `example.com` and `www`.
- Docker and the compose plugin on the VM.

## First deploy

```bash
git clone https://github.com/<you>/retropdf.git
cd retropdf/deploy

cp .env.example .env
# Then edit .env and put your real domain in it.

docker compose up -d --build
```

`.env` is the only file naming the actual deployment, and it is gitignored.
Everything the server needs to know about itself lives there rather than in
the repository.

Caddy requests a certificate on first start, which needs port 80 reachable
from the internet. Watch it happen:

```bash
docker compose logs -f caddy
```

## Checking it worked

The three things worth verifying, because they are the ones that can pass
locally and fail in production:

```bash
# The header the entire privacy claim rests on.
curl -sI https://retropdf.com | grep -i content-security-policy

# Canonical links and the share card must be absolute and on the real domain,
# or search engines and chat apps cannot resolve them.
curl -s https://retropdf.com | grep -E 'canonical|og:image'

# The tools themselves, driven through a real browser against the live site.
BASE=https://retropdf.com node tests/tools.e2e.mjs
```

Then open the site, pick a PDF, and watch the Network tab while a tool runs.
Nothing should leave. That is the claim, and it is worth confirming on the
real deployment rather than trusting that it carried over.

## Updating

```bash
git pull
docker compose up -d --build
```

The tally of desktop app interest lives in a named volume, so replacing the
container keeps it.

## Access logs are off

`deploy/Caddyfile` discards them. A web server records every request with an
IP address and a timestamp by default, which would be data about visitors
sitting on the disk. Nothing else in this project keeps anything about
anyone, and the privacy page states that logging is off, so that line is what
makes the claim true. If you turn logging on, change the privacy page.

## Hardening

Nothing in this repository names the server: no address, no hostname, no
user, no key. That is deliberate and worth keeping. The notes below describe
what is switched off rather than how to reach anything, which is safe to
publish and useless to an attacker.

Client side processing removes most of the usual attack surface. There is no
database, no upload endpoint, no accounts and no user data on the server, so
SQL injection, upload exploits and cross user leaks are impossible by
construction rather than by care.

What remains is worth being precise about: **if someone gains write access to
the server, they can serve different JavaScript.** They would change `app.js`
to send every opened file to themselves and loosen the CSP that would
otherwise block it, and nothing on the page would look different.

That is true of every website. It matters more here because the privacy claim
is stronger. The defence is that nobody gets write access:

- SSH keys only, password authentication disabled. Scanners attempt password
  logins on every server on the internet continuously.
- Nothing else on the VM. No side projects, no development tools.
- The container runs as a non-root user, so compromising the app is not
  compromising the host.
- Unattended security updates on.
- Firewall open on 80 and 443 only, with SSH restricted by source address
  where possible.
- Two factor on the registrar, the host and the code forge. Compromising the
  code account would allow a poisoned deploy without touching the server.

## Before going live

- [ ] Buy the domain and point it at the VM before the first deploy. Caddy
      requests the certificate on first start and needs the name resolving
      already, so deploying first means deploying twice.
- [ ] Check `hello@retropdf.com` exists and reaches you. It is the contact
      address on the privacy, terms and security pages, and the GDPR entry
      the privacy page relies on is a name plus a working address.
- [ ] Read the privacy, terms and security pages once as a stranger would.
      They make specific claims about what the site does, and they have to
      stay true as the site changes.
