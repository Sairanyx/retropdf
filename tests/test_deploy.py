"""The deployment configuration matches what the code reads.

A name that differs between the compose file and the code does not fail: the
variable simply goes unset and the default is used. In production that means
every canonical link, sitemap entry and share image points at localhost, which
is invisible until a search engine or a chat app tries to follow one.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN = (ROOT / "app" / "main.py").read_text(encoding="utf-8")
COMPOSE = (ROOT / "deploy" / "compose.yml").read_text(encoding="utf-8")
CADDYFILE = (ROOT / "deploy" / "Caddyfile").read_text(encoding="utf-8")
DOCKERFILE = (ROOT / "deploy" / "Dockerfile").read_text(encoding="utf-8")


def env_names(text: str) -> set:
    """Every RETROPDF_ name mentioned anywhere in a file."""
    return set(re.findall(r"RETROPDF_[A-Z_]+", text))


def test_compose_sets_names_the_code_reads():
    """Anything compose sets must be a name the app actually looks for."""
    reads = env_names(MAIN) | env_names(DOCKERFILE)
    # The domain is used by compose and Caddy rather than by the app.
    sets = env_names(COMPOSE) - {"RETROPDF_DOMAIN"}
    unknown = sets - reads
    assert not unknown, f"compose sets names the code never reads: {sorted(unknown)}"


def test_the_base_url_is_set_in_production():
    """Without it every absolute URL points at localhost."""
    assert "RETROPDF_BASE_URL" in COMPOSE
    assert "RETROPDF_BASE_URL" in MAIN


def test_the_counter_is_kept_outside_the_container():
    """A container is replaced on every deploy. A count written inside one
    would reset each time."""
    assert "RETROPDF_COUNT_FILE" in DOCKERFILE
    assert "/data" in COMPOSE


def test_access_logs_are_off():
    """The privacy page says logging is off, so this is what makes it true."""
    assert "output discard" in CADDYFILE


def test_caddy_does_not_repeat_the_security_headers():
    """The app sets them. Two places setting the same header is how they end
    up disagreeing, and the CSP is the whole privacy claim."""
    assert "Content-Security-Policy" not in CADDYFILE
