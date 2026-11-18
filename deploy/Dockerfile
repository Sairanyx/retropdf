# The site, as one container.
#
# Two stages: the first installs the Python packages, the second copies only
# what is needed to run. The build tools and the package index cache stay
# behind, which keeps the image small and gives an attacker less to work with.

FROM python:3.12-slim AS build

WORKDIR /install
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt


FROM python:3.12-slim

# Not root. Compromising the app is then not compromising the container.
RUN useradd --create-home --shell /usr/sbin/nologin retropdf

WORKDIR /app

COPY --from=build /install/deps /usr/local
COPY app/ app/

# Where the desktop app tally lives. Mounted as a volume in compose, so it
# survives the container being replaced.
ENV RETROPDF_COUNT_FILE=/data/interest.count
RUN mkdir -p /data && chown retropdf:retropdf /data
VOLUME /data

USER retropdf

EXPOSE 8000

# Caddy terminates TLS and talks to this over the internal network, so there
# is no reason for it to listen anywhere else.
#
# --no-access-log for the same reason Caddy's log is discarded. Uvicorn
# otherwise prints a line per request, with the address, the page and the
# time, and Docker keeps everything a container prints in a file on the host.
# The privacy page says access logging is off, and both logs have to be off
# for that to be true. Errors and startup messages are still printed.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
