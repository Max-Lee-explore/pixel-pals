# Pixel Pals: Study Pets – a Chrome extension for localisation practice

Adopt a pixel-art **cat, dog, rabbit or hamster**, give it a name, and it lives in your Chrome browser:

| | Cat | Dog | Rabbit | Hamster |
|---|:---:|:---:|:---:|:---:|
| **Happy** | <img src="docs/pets/cat-idle.png" width="96" alt="Cat, happy"> | <img src="docs/pets/dog-idle.png" width="96" alt="Dog, happy"> | <img src="docs/pets/rabbit-idle.png" width="96" alt="Rabbit, happy"> | <img src="docs/pets/hamster-idle.png" width="96" alt="Hamster, happy"> |
| **Sleepy** | <img src="docs/pets/cat-sleep.png" width="96" alt="Cat, sleeping"> | <img src="docs/pets/dog-sleep.png" width="96" alt="Dog, sleeping"> | <img src="docs/pets/rabbit-sleep.png" width="96" alt="Rabbit, sleeping"> | <img src="docs/pets/hamster-sleep.png" width="96" alt="Hamster, sleeping"> |
| **Sad** | <img src="docs/pets/cat-sad.png" width="96" alt="Cat, sad"> | <img src="docs/pets/dog-sad.png" width="96" alt="Dog, sad"> | <img src="docs/pets/rabbit-sad.png" width="96" alt="Rabbit, sad"> | <img src="docs/pets/hamster-sad.png" width="96" alt="Hamster, sad"> |

- **Pet** – feed, play with and put your pet to sleep; watch happiness, energy, XP and level. Pets level up from playing and from finished focus sessions.
- **Wardrobe and titles** – levelling up unlocks four secret accessories your pet can wear, and gives it new titles. Level up to find out what they are!

  | Level | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 |
  |---|---|---|---|---|---|---|---|---|---|
  | Unlocks | Newcomer | 🔒 ??? | Study Buddy | 🔒 ??? | Bookworm | 🔒 ??? | Scholar | 🔒 ??? | Professor |

- **Focus** – a study timer (Pomodoro). Every finished session gives your pet XP and sends a desktop notification.
- **Timetable** – add your weekly classes and see what's next today.
- **Pet on web pages** – your pet walks along the bottom of the websites you visit and gives tips when you click it.
- **Settings** – rename your pet or change the animal, switch the display language, run pseudo-localisation, and check a translation file.

The extension is written in **English**. All interface text lives in one file:

```
_locales/en/messages.json      ← 127 strings, about 450 words
```

Your task is to translate this file in **Phrase TMS**, put the translated file back into the extension, and test the localised extension in Chrome.

---

## 1. Install the extension (English)

1. Download or unzip this folder (`chromeplugin`) to your computer.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and choose the `chromeplugin` folder (the one that contains `manifest.json`).
5. Click the puzzle icon in the toolbar and pin **Pixel Pals: Study Pets**.
6. Open it, choose an animal, type a name (or keep the suggested one) and click **Adopt**.

Explore every screen first. You cannot translate a UI well without seeing it.

Useful testing tools in **Settings → Display language**:

| Option | What it does |
| --- | --- |
| Pseudo-localisation (test) | Shows fake accented and ~35% longer text, e.g. `[Ƒééď~~]`. Shows which text is translatable and where long text will break the layout. |
| Show string keys (test) | Shows the key (e.g. `btnFeed`) instead of the text, so you can find where each string appears in the UI. |

---

## 2. The source file

Chrome extensions store strings in the **Chrome JSON i18n** format:

```json
"moodHappy": {
  "message": "$PETNAME$ is feeling great!",
  "description": "Status line on the Pet page when the pet is very happy. Max 40 chars.",
  "placeholders": {
    "petname": { "content": "$1", "example": "Pip" }
  }
}
```

| Part | Translate? |
| --- | --- |
| `moodHappy` (the key) | **No** – the code uses it to find the string. |
| `message` | **Yes** – this is the text users see. |
| `description` | No – it is the context note for you, the translator. |
| `$PETNAME$` | **No** – a placeholder. The program replaces it with a value (here, the pet's name). You may move it within the sentence, but do not translate, delete or misspell it. |
| `placeholders` / `content` / `example` | No – technical definitions of the placeholders. |

---

## 3. Translate in Phrase TMS

### 3.1 Create the job

1. Copy `_locales/en/messages.json` somewhere easy to find.
2. In Phrase TMS, create a project: **source language English**, **target language** = your language.
3. Create a job and upload `messages.json`.
4. Before importing, open the **file import settings → JSON** and set:

| Setting | Value | Why |
| --- | --- | --- |
| Import specific keys only (use regex) | `.*/message` | Only the `message` values are translatable. |
| Context note | `../description` | Shows each description as a context note in the editor. |
| Convert to Phrase tags | `\$[^\$]+\$` | Turns `$PETNAME$`, `$COUNT$` etc. into protected tags. |
| Use HTML subfilter | off | The strings contain no HTML. |

> Phrase's own "Chrome JSON i18n" recommendation also imports `.*/content`. In this file every `content` value is a technical `$1`/`$2`, so we leave it out.

If you imported the file with the wrong settings (for example, the descriptions or keys appear as segments), delete the job and import it again with the settings above.

### 3.2 Translation challenges hidden in this file

Read the context note for **every** segment. Look out for:

- **Ambiguity** – `Feed`, `Play` and `Nap` are verbs (actions for the pet), not a "news feed" or "play a video". `Start` appears twice: the `btnStart` button is a verb, while the `fieldStart` form label is a noun (start time).
- **Placeholders and word order** – `Great work! $PETNAME$ earned $XP$ XP. Time for a $MINUTES$-minute break.` Move tags wherever your grammar needs them, but keep all of them.
- **Space constraints** – most descriptions say `Max N chars`. Tabs and buttons are narrow and will be cut off with "…" if your text is too long.
- **Plurals** – `sessionsToday_one` / `sessionsToday_other` and similar pairs. If your language does not change nouns for number (e.g. Chinese, Japanese), you can translate both the same way.
- **Names** – `defaultNameCat`, `defaultNameDog`, `defaultNameRabbit` and `defaultNameHamster` (Pip, Biscuit, Clover, Peanut) are suggested pet names. Adapt them to names that sound cute and natural in your language. The pet's name is inserted into many other strings as `$PETNAME$`, so check that your sentences work with any name.
- **User content** – the name the user types for their pet is *not* in the file and is never translated. Test your strings with a long name, a short name and a name in another script.
- **Animal names** – `speciesCat`, `speciesDog` … appear under small pictures and in a dropdown, so keep them short.
- **Titles** – `titleNewcomer` … `titleProfessor` are ranks shown under the pet's name. They must work for any animal and any pet name, so avoid words that only fit one gender or one animal. They are also inserted into `reactNewTitle` ("Level 5! New title: Bookworm") – check the grammar there.
- **Accessories** – the `acc…` item names label tiny wardrobe buttons (max 10 characters). Some of them are ambiguous in English, so read each description before you translate. Locked items show `accSecret` ("???") instead of their name – decide whether your language keeps "???" or uses something else.
- **Abbreviations and conventions** – `e.g.`, `min`, `XP`, the time-range dash in `$START$–$END$`.
- **Tone** – the pet's speech bubbles (`react…`, `pagePetTip…`) are playful; buttons and error messages are neutral.
- **Technical string** – `appLocale` is **not** a word to translate. Replace `en` with your locale code (see the table in 4.1). It controls date, time and number formatting.
- **Not in the file at all** – weekday names, times and numbers are formatted automatically by the browser, and class names typed by the user are never translated. Check this during testing.

### 3.3 QA in Phrase

Run **QA** in the Phrase editor and fix at least: missing/extra tags, empty segments, inconsistent translations and terminology, and length problems. Keep a list of issues you decided to ignore and why.

### 3.4 Export

Mark the job as **Completed** and download the target file. Phrase may name it differently (e.g. `messages_zh_HK.json` or with a job number). **Rename it to exactly `messages.json`.**

---

## 4. Reintegrate the file

### 4.1 Put it in the right folder

Create a folder inside `_locales` named with your **Chrome locale code**, and put the file in it:

```
chromeplugin/
└── _locales/
    ├── en/
    │   └── messages.json
    └── zh_HK/            ← your new folder
        └── messages.json ← your translated file
```

| Language | Folder name |
| --- | --- |
| Chinese (Hong Kong) | `zh_HK` |
| Chinese (Simplified) | `zh_CN` |
| Japanese | `ja` |
| Korean | `ko` |
| French | `fr` |
| Spanish | `es` (Latin America: `es_419`) |
| German | `de` |
| Portuguese (Brazil) | `pt_BR` |

Use an **underscore**, not a hyphen (`zh_HK`, not `zh-HK`). Chrome's [list of supported locales](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales) uses `zh_TW` for Traditional Chinese; this course uses `zh_HK`. Put your file in `_locales/zh_HK/` and pick it in **Settings → Display language**.

### 4.2 Reload

Go to `chrome://extensions` and click the **reload** icon (↻) on the extension's card.

If Chrome shows an error and refuses to load the extension, your file is usually broken JSON. Common causes are a missing comma or quote from editing the file by hand, a file not saved as UTF-8, or a wrong folder name. Open the file in a code editor (e.g. VS Code), which highlights JSON errors, or paste it into a JSON validator.

---

## 5. Test the localised extension

1. Open the extension → **Settings → Display language** → choose your language. The popup reloads in your language.
2. Click **Translation check → Check**. It compares your file with the English source and lists:
   - missing, empty or extra strings
   - placeholders that do not match the English (e.g. a translated `$PETNAME$`)
   - strings that are longer than the `Max N chars` limit
   - strings identical to the English (maybe forgotten)
   - an `appLocale` value that is still `en`
3. Go through the UI with this checklist and take screenshots of any problems:
   - [ ] All four tabs – is any text cut off ("…"), overlapping or wrapping badly?
   - [ ] Pet – press Feed, Play, Nap many times to see all speech bubbles and moods (Feed more than 4 times to see "I'm full").
   - [ ] Focus – set Focus to **1** minute, press Start and wait. Check the desktop notification, the break phase and the "sessions today" sentence (with 1 and with 2 sessions).
   - [ ] Timetable – add classes, trigger both error messages (empty name; end time before start time), check weekday names, time format and the "Next up" box. Hover over the × button to see its tooltip.
   - [ ] Web pages – open any website, click your pet for tips; while a focus session is running, click it to see the "minutes to go" message. Hover to see the × tooltip.
   - [ ] Adoption and level-up – *Settings → Reset all data* shows the adoption screen again: check the animal names and the suggested names. Play with your pet until it levels up to see the level-up message.
   - [ ] Wardrobe and titles – at level 2 the pet unlocks its first secret item, at level 3 a new title. Check both level-up messages, the title under the name, every wardrobe label, and the "Unlocks at level …" tooltip on locked items. Focus sessions give 20 XP each, so a few short 1-minute sessions level the pet up quickly.
   - [ ] Pet name – rename your pet in *Settings → Your pet* (try a long name) and check every sentence that contains the name.
   - [ ] Is the terminology consistent across screens (e.g. "focus session", "break", "XP")?
4. Fix issues in Phrase (keep your TM up to date!), export again, replace the file, reload and re-test.

### Seeing it the "real" way (optional)

The **Display language** menu is a testing shortcut. Real users get the language that matches their Chrome UI language, and the extension's name and description on `chrome://extensions` only change this way:

- **Windows / ChromeOS:** `chrome://settings/languages` → your language → ⋮ → *Display Google Chrome in this language* → Relaunch.
- **macOS:** Chrome follows the system language. Go to *System Settings → General → Language & Region → Applications*, add Google Chrome with your language, then restart Chrome.

Then set the extension's Display language back to *Same as Chrome*.

---

## 6. Extension activities

- **Plural forms:** Chrome's format has no built-in plurals. The extension picks `key_<category>` using the [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) and falls back to `key_other`. If your language has more forms (Polish, Russian, Arabic, …), add entries such as `sessionsToday_few` or `sessionsToday_many` to your exported file by copying the `_other` entry. Discuss why this cannot easily be done inside the TMS.
- **Right-to-left:** the popup switches to right-to-left layout automatically for Arabic, Hebrew and Persian. If you know one of these languages, test the layout.
- **Compare:** run pseudo-localisation and your real translation side by side. Which problems did pseudo-localisation predict?

---

## Project structure

```
manifest.json            Extension manifest (name/description use __MSG_extName__ etc.)
_locales/en/messages.json  English source strings ← translate this
background.js            Timer alarms and notifications
popup/                   The toolbar popup (HTML, CSS, JS, translation check)
content/pet.js           The pet on web pages
lib/i18n.js              Loads strings, placeholders, plurals, pseudo-localisation
lib/store.js             Pet (species, name, XP, level), timer and timetable data
images/pets/             16×16 pixel-art sprites: <animal>-idle / -sleep / -sad.png
                         and see-through accessory layers: acc-<item>.png
icons/                   Toolbar icons (regenerate with: python3 tools/make_icons.py)
docs/pets/               Enlarged sprite previews for this README (same script)
```

The sprites were drawn in Cursor with the [Pixel Art MCP server](https://github.com/adrianoamaral/pixel-mcp) (`pxcli-mcp`), which exports straight into `images/pets/`.

All data is stored locally in the browser (`chrome.storage.local`); nothing is sent to the internet.
