---
name: import-content
description: Use when the product owner hands over one piece of content to put into Motivana - a quote found while browsing, or an image to use as a wallpaper template. Routes the paste to the quote catalogue or the background catalogue and runs the gates. For a bulk harvest of many quotes or images, use sourcing-quotes or sourcing-backgrounds instead.
---

# Import Content

## Overview

The owner meets something good on the internet and pastes it here. This skill
puts that one thing into the app and reports what it did.

**Core principle: one paste, one entry, no search.** The two sourcing skills
find content and argue about whether to keep it. This skill does neither. The
choice was already made by the person who pasted it, so the work left is to
record it honestly and hold the gates that describe the app.

## Route First, and Say Which Lane

Look at the paste and announce the lane before you touch anything:

| What arrived                        | Lane                      |
| ----------------------------------- | ------------------------- |
| Text, with or without a URL         | **Lane A** - quote        |
| An image file path, or an image URL | **Lane B** - background   |
| A screenshot of text                | Ask - see below           |
| Several quotes at once              | Lane A, once per quote    |
| A URL alone, no quote               | Ask which line they meant |

**A screenshot of text is ambiguous and you must ask.** It can be a quote to
read out of the picture, or a picture to make a wallpaper from. Do not guess:
the two lanes write to different files and one of them is hard to undo.

**An image pasted into the chat is pixels you cannot write to disk.** Lane B
needs a file path or a URL. Ask for one rather than describing the image into a
catalogue entry.

## Never Do These

- **Never invent provenance.** The owner did not name a source, so
  `verification` is `owner-supplied`. Writing `grep-primary` for a line nobody
  opened is a lie that outlives the session.
- **Never guess an author.** No name means leave `author` out. An absent author
  is supported - the wallpaper draws no author line and no gap for it. An empty
  string fails the gate, and a guessed name is worse than either.
- **Never write `assets/data/quotes.json` by hand.** Lane A goes through
  `promote-quotes.mjs`, which renumbers ids and moves provenance out. A hand
  edit skips both.
- **Never renumber or reuse a background id.** Gaps in `mountain-01, -02, -04`
  are deliberate: a shipped id may be somebody's wallpaper right now.
- **Never edit `scripts/verify-data.mjs`, the catalogue tests, or
  `RotationCatalog.kt` to fit a paste.** One item is never worth changing the
  app's contract. If a gate rejects it, tell the owner why and stop.
- **Never run a licence argument on the owner's own image.** They hold it.
  Lane B has no licence step, and raising one wastes their time.

## Lane A: A Quote

The owner's standing instruction is trust the paste: no source fetch, no
reviewer subagent. What replaces that review is a cheap pre-check, because the
gates below fail _after_ you have written a staging file, and reading them first
is faster than a failed promote.

### Step 1: Pre-check the four gates that bite

| Gate          | Rule                                                       |
| ------------- | ---------------------------------------------------------- |
| Length        | 12 to 160 characters, per locale                           |
| Normalisation | NFC - re-type Vietnamese diacritics rather than trust them |
| Duplicate     | not already in `assets/data/quotes.json`, any locale       |
| Timeless      | no year, event, war, election, company, product or website |

The timeless test is the one worth arguing about, and it is the owner's call.
Say so plainly and let them decide: _"this names a company, which dates it -
still want it in?"_

### Step 2: Write a one-entry staging file

`docs/quote-candidates/<YYYY-MM-DD>-import.json`. The verdict is pre-set to
`approve`, because the owner already approved it by pasting it:

```json
{
  "candidates": [
    {
      "text": { "vi": "Có công mài sắt, có ngày nên kim." },
      "sourceLocale": "vi",
      "category": "discipline",
      "provenance": {
        "sourceKind": "owner-supplied",
        "providedBy": "owner",
        "verification": "owner-supplied",
        "rights": "unknown-author",
        "englishRendering": "none",
        "edit": "none"
      },
      "review": {
        "verdict": "approve",
        "reason": "pasted by the owner",
        "category": "discipline"
      }
    }
  ]
}
```

Two shapes of provenance, and the promoter checks for exactly one of them:

- **A URL came with the paste.** Keep it. Set `sourceUrl` and the real
  `sourceKind` (`news`, `social-post`, `transcript`, `primary-text`,
  `reference-work`, `wikiquote-cited`), and still set
  `verification: "owner-supplied"` - you recorded a URL, you did not open it.
- **No URL.** `sourceKind: "owner-supplied"` and `providedBy` naming who handed
  it over. The promoter refuses an owner-supplied record that names nobody.

`edit` records every change you made to the pasted wording, down to a comma:
straightened quotes, a dropped trailing full stop, a joined line break. Anything
you leave out becomes the author's own words to the next reader.

Only set `text.en` **and** `text.vi` when the owner gave you both. Do not
translate to fill the other slot: a translation you wrote is your sentence under
someone else's name.

### Step 3: Promote

```bash
node scripts/promote-quotes.mjs docs/quote-candidates/<file>.json --owner-supplied --dry-run
node scripts/promote-quotes.mjs docs/quote-candidates/<file>.json --owner-supplied
pnpm verify:data && pnpm test
```

`--owner-supplied` lifts the cull ceiling, which a one-entry batch would fail on
its face. Every other rule holds.

**The floor that can still stop you** is in `verify-data.mjs`: every category
needs at least 6 quotes. An import only adds, so it cannot break that floor; a
retire can. The message names the category; report it and ask whether to file
the quote elsewhere.

**Every id moves on a promote.** The catalogue is renumbered, so never quote a
specific id back to the owner as though it were stable.

## Lane B: An Image

The owner's own image, for use as a template. No licence check, no creator
required. Every geometric step still runs, because a quote landing under the
lock-screen clock is broken whoever owns the photograph.

```bash
python3 .claude/skills/sourcing-backgrounds/scripts/build_backgrounds.py import \
  --repo . --image <path> --category <category> --title "<a human name>"
pnpm verify:data && pnpm test
```

Download a URL to a file first. `--creator` and `--url` are optional; take them
only if the owner offers.

Category must be one of `mountain`, `ocean`, `sky`, `cosmos`, `texture`,
`botanical`, `nocturne`, `architecture`. Read `sourcing-backgrounds` on what
each one holds before you pick - the categories describe a look, not a subject.

The stage is additive and does all of it in one pass: crops to 9:16 (keeping the
whole frame untouched when the image already is 9:16, since the owner framed
it), measures the quote band, derives the font and the scrim from how busy that
band is, places the text block clear of the clock and the shortcut row, encodes
WebP, takes the next free id in the category, and regenerates
`backgroundAssets.ts`. It renumbers nothing.

### Read the three things it prints back

They are the whole review, and two of them need a decision from the owner:

| Output                       | What to do                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `cropped to 9:16 at fx= fy=` | Nothing. It reports which window won                                                                         |
| `warning: upscaling ...`     | Tell the owner the image is under 1290x2796 and will soften. Their call                                      |
| `note: very flat frame`      | Usually fine and sometimes the point. In a harvest this is a reject; from the owner it is a plain background |
| `the 9:16 crop is only ...`  | It refused. Under 70% of target width there is no fixing it in software - ask for a bigger file              |

**Look at the crop before you call it done.** No measurement judges subject
matter. Open `assets/images/backgrounds/<id>.webp` and check the crop did not
cut a face in half or centre the one busy corner. Deleting the file and
re-running is cheap; a bad wallpaper shipping is not.

## Undoing an Import

Both lanes touch tracked files and nothing else, so `git` is the undo. Know
which files before you start, because a partial revert leaves a catalogue and a
folder that disagree - and that fails quietly in both directions.

| Lane | Files                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| A    | `assets/data/quotes.json`, `docs/quote-candidates/provenance.json`, the staging file                                |
| B    | `assets/data/backgrounds.json`, `src/features/wallpaper/backgroundAssets.ts`, `assets/images/backgrounds/<id>.webp` |

For Lane B, `build_backgrounds.py sync --repo .` rebuilds the catalogue and the
asset module from whichever images remain, so deleting the `.webp` and syncing
is the tidier undo than reverting three files by hand.

## Rationalizations

| Thought                                                    | Reality                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| "It is one quote, I will edit quotes.json directly"        | The promoter renumbers ids and splits provenance out. A hand edit produces a catalogue no script can rebuild |
| "The paste has a URL, so `verification` is `grep-primary`" | You recorded a URL. `grep-primary` means you found the wording inside the source text                        |
| "The quote sounds like Confucius, I will credit him"       | A guessed attribution on a shareable wallpaper is a permanent error. Leave `author` out                      |
| "The owner's screenshot is obviously a background"         | It is obviously an image. Whether they wanted the picture or the words in it is not visible. Ask             |
| "The gate rejected it, so the gate is too strict"          | The gate is the app's contract and this is one item. Report the rejection to the owner                       |
| "The crop measured well, so I do not need to look"         | No scorer judges subject matter. That is the part only a person can do                                       |
| "texture-05 is missing, I will reuse the number"           | A gap is an id that shipped. Reusing it changes the wallpaper under whoever set it                           |

## Red Flags - Stop

- You are writing an `author` the owner did not give you
- You are writing `verification` as anything but `owner-supplied`
- You are about to open `assets/data/quotes.json` in an editor
- You are translating the paste into the other locale
- You are choosing a lane for a screenshot instead of asking
- You are about to report success without having run `pnpm verify:data && pnpm test`
