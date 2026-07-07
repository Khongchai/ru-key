# ru-key — Russian Touch Typing Trainer

A minimal dark-themed webapp for learning to touch type Russian (ЙЦУКЕН layout).

## Features

- **On-screen keyboard** showing the ЙЦУКЕН layout with the next key highlighted (Latin legends in the corner of each key, home-row markers included).
- **No OS layout switching needed** — physical keys are mapped to Cyrillic (Q→й, W→ц, …), and a real Russian layout works too.
- **Rolling word line** — the current word sits in the center with its English meaning below; completing a word rolls the line left.
- **Mistakes turn the word red**; backspace to correct, Esc to skip a word.
- **1000 default words** with English meanings, roughly frequency-ordered (sampling is biased toward common words) and covering all 33 Cyrillic letters.
- **Custom word list** — the ☰ menu accepts a comma-separated list (`слово` or `слово=meaning`) that overrides the default, persisted in localStorage.
- Live WPM / accuracy / word count.

## Word list validation

```bash
node validate.js
```

Checks that all entries are well-formed, unique, and that all 33 Cyrillic letters are covered.

## Run locally

Just open `index.html` in a browser — no build step, no dependencies.
