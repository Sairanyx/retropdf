# app/translations/

One JSON file per language, all with the same keys. Templates ask for
`t("key")`; scripts get the `js.*` keys through the page.

- `en.json` is the reference. A key missing elsewhere falls back to English.
- Keep `{placeholders}` exactly as in English. The tests check this.
- `privacy.*` is the privacy notice. The English version governs, so change
  English first and every translation with it.
- Adding a language: a file here plus an entry in `../languages.py` and
  `../flags.py`.

The tests in `tests/test_languages.py` fail if any language is missing a key
or a placeholder.
