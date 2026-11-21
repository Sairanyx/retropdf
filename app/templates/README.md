# app/templates/

Jinja templates. Every page extends `base.html`, and every word comes from
`t("key")`, looked up in [../translations](../translations/README.md).

| Template | Page |
|---|---|
| `base.html` | Header, language picker, footer and scripts shared by every page |
| `home.html` | The home page |
| `tool.html` | One tool. All 8 tool pages use it with a different mode |
| `workspace.html` | Every tool on one page, for chaining them on one file |
| `desktop.html` | The desktop app counter page |
| `privacy.html` | Privacy notice, in every language |
| `terms.html`, `security.html` | English only, on purpose (see `languages.py`) |
| `error.html` | 404, 405, 500 and other errors |
| `bench.html` | Development only memory test, at `/bench` when `RETROPDF_DEV=1` |
