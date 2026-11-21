# app/

The server. It only hands out pages: it never receives a file.

| File | What it does |
|---|---|
| `main.py` | Every route, one per page and language, plus error pages, `robots.txt` and the sitemap |
| `security.py` | Headers on every response, including the CSP (`connect-src 'none'`) and caching |
| `languages.py` | The 11 languages and their addresses (`/merge-pdf`, `/es/merge-pdf`, ...) |
| `tools.py` | The 8 tools: one address and one mode each |
| `interest.py` | The desktop app counter, the only thing the server stores |
| `flags.py` | The flag drawn on each language in the picker |
| `tool_art.py` | The line drawing for each tool |
| `templates/` | HTML pages ([README](templates/README.md)) |
| `translations/` | The words in each language ([README](translations/README.md)) |
| `static/` | CSS, fonts, icons and the browser code ([README](static/js/README.md)) |

Settings, all optional, read from the environment:

| Variable | Default | Purpose |
|---|---|---|
| `RETROPDF_BASE_URL` | `http://127.0.0.1:8000` | Absolute links: canonical, sitemap, share image |
| `RETROPDF_HTTPS` | off | Sends HSTS. Turn on only behind TLS |
| `RETROPDF_DEV` | off | No caching of scripts, and the `/bench` page |
| `RETROPDF_COUNT_FILE` | `interest.count` | Where the desktop app count is kept |
