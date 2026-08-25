---
name: sourcing-quotes
description: Use when the Motivana quote catalogue needs real quotes - adding, replacing or refreshing entries in assets/data/quotes.json, removing app-written filler, or when asked to find quotes from talks, books, literature, news or social posts.
---

# Sourcing Quotes

## Overview

Motivana ships human words, not machine words. This skill turns the open
internet into catalogue entries that a person really said, that somebody can
check, and that carry no date inside them.

**Core principle: two agents, two files.** The harvester finds and records; it
never approves. The reviewer approves, categorises and culls; it never sources.
One agent doing both marks its own homework.

**Vietnamese is the target language, not a translation step.** Read
`references/vietnamese-sources.md` before the first fetch.

## The Contract

State these four numbers before you start, and hold them:

|                              | Value                                       |
| ---------------------------- | ------------------------------------------- |
| Candidates per harvest       | 50 (minimum 40)                             |
| Approved output              | at most half of the candidates              |
| Vietnamese share of approved | at least 70%                                |
| Staging file                 | `docs/quote-candidates/<date>-<topic>.json` |

Half is a ceiling, not a target. A harvest that approves 24 of 50 is healthy.
A harvest that approves 45 of 50 did not search hard enough to have a choice.

## Never Do These

- **Never write to `assets/data/quotes.json` during a harvest.** Candidates go
  to the staging file. Only the promote step touches the catalogue.
- **Never edit `scripts/verify-data.mjs`, `RotationCatalog.kt`, or any test to
  fit your harvest.** The gate describes the app; your harvest is the variable.
  If the gate rejects your batch, the batch is wrong.
- **Never approve your own candidates.** Dispatch the reviewer. Even for one
  quote. Even when the sourcing was easy.
- **Never keep a quote whose only trail is a quote-aggregator site.** No primary
  or cited secondary source means no entry.
- **Never translate an attributed author's words into Vietnamese to fill the
  Vietnamese share.** Source material that was written in Vietnamese. A
  translation you wrote is your sentence with their name on it.

## Step 1: Harvest

Search for material, not for quotes. `WebSearch` to find the primary text, then
`WebFetch` the source itself: vi.wikisource.org, thivien.net, Project Gutenberg,
a talk transcript, the author's own published page. Quote aggregators
(brainyquote, azquotes, goodreads, Facebook "danh ngôn" pages) are leads to
verify, never sources to cite.

Write every candidate as this record. Every field is required:

```json
{
  "text": {
    "vi": "Đường đi khó không khó vì ngăn sông cách núi mà khó vì lòng người ngại núi e sông.",
    "en": "The road is hard, not because rivers and mountains block it, but because the heart shrinks from them."
  },
  "sourceLocale": "vi",
  "author": "Nguyễn Bá Học",
  "category": "discipline",
  "provenance": {
    "sourceUrl": "https://vi.wikisource.org/wiki/...",
    "sourceKind": "primary-text",
    "citation": "Quốc văn trích diễm, 1925",
    "verification": "grep-primary",
    "rights": "public-domain",
    "englishRendering": "ours",
    "edit": "none"
  }
}
```

This example is a real quote and the catalogue already ships it. Do not
re-harvest it: `promote-quotes.mjs` refuses a duplicate, which costs you a whole
review cycle to find out.

- `sourceKind`: `primary-text` | `reference-work` (a dictionary or a proverb
  collection) | `wikiquote-cited` | `transcript` | `news` | `social-post`
- `verification`: `grep-primary` (you found the wording inside the full source
  text) | `cited-secondary` | `weak`. Weak means reject.
- `rights`: `public-domain` | `folk-anonymous` | `in-copyright`
- `englishRendering`: `ours` | `published:<translator>` | `none`
- `edit`: `none`, or every change you made to the source wording - words cut,
  verse lines joined, a first letter capitalised, the source's own quotation
  marks dropped. Anything you do not record becomes the author's own words in the
  next reader's eyes. Do not modernise old spelling (`hi-vọng`, `tự-trọng`):
  that rewrites every word, so reject the candidate instead.

Record rejections in the same file under `"rejected"`, with the reason. The
rejections are the most reusable part of a harvest: they stop the next run
finding the same fake.

## Step 2: Review

Dispatch one subagent. Give it the staging file path and this task, and let it
read this skill for the rules:

> Review the candidates in `<staging file>` for the Motivana catalogue. For each
> one, decide `approve` or `reject` with a one-line reason, and set the
> category. Re-verify the main claim of every candidate you approve: open its
> `sourceUrl` and confirm the wording and the author. Approve at most half.
> Report the approved count, the Vietnamese share, and every candidate whose
> provenance you could not confirm. Write your verdicts into the file as
> `"review": { "verdict": ..., "reason": ..., "category": ... }`. Do not touch
> `assets/data/quotes.json`.

The reviewer rejects on any of: wording absent from the source, uncertain
author, an event or date inside the text, a named institution or product, text
under 12 or over 160 characters, near-duplicate of a catalogue entry, or
Vietnamese text with broken diacritics.

**It also rejects on readability.** A reader has to take the whole line in at a
glance, off a wallpaper, with no context. Perfect provenance does not save a
Hán-Việt maxim that a reader today cannot parse. In the first real harvest this
was the top cause of rejection, above every provenance problem.

## Step 3: Promote

```bash
node scripts/promote-quotes.mjs docs/quote-candidates/<file>.json --dry-run
node scripts/promote-quotes.mjs docs/quote-candidates/<file>.json
pnpm verify:data && pnpm test
```

The script takes only `review.verdict === "approve"` entries, moves
`provenance` into `docs/quote-candidates/provenance.json`, appends each quote to
its category block, and renumbers every ID so `category-001..N` stays
sequential. Never renumber by hand.

**Retiring app-written filler.** Add `--retire-filler=<per category>` to drop
original app copy as the sourced quotes arrive. The script keeps that many
filler entries in each category, preferring the ones that carry Vietnamese, and
it can only ever retire an entry with no record in `provenance.json` - a sourced
quote is never a candidate for retirement. Retire in the same run as the
promote, so the catalogue never shrinks below its floor between two commands.

**Every ID moves when you promote.** The catalogue is renumbered, so no test may
name a specific ID for a property it does not own. If a test breaks on an ID,
make the test read the catalogue; do not shuffle the data to keep an ID in
place.

## Quotes the Owner Hands You

Lines that arrive from the product owner, with no source named, do not go
through a harvest. They are already chosen, so the cull ceiling does not apply:

```bash
node scripts/promote-quotes.mjs <staging-file>.json --owner-supplied --dry-run
```

`--owner-supplied` lifts the ceiling and nothing else. Every other rule holds:
the record still goes in a staging file, the schema and duplicate checks still
run, and the quote still cannot reach the catalogue with no provenance at all.

What changes in the record:

- `sourceKind: "owner-supplied"` and `providedBy: "<who handed it over>"`
  instead of a `sourceUrl` there is no URL to give.
- `verification: "owner-supplied"`. Do not write `grep-primary` for something
  you never found in a source text.
- `rights: "unknown-author"` when the line circulates with no name on it. That
  is the honest value, and it is a real state: somebody wrote it and will not be
  credited.
- **Leave `author` out.** Do not guess a name, and do not write an empty string:
  the gate rejects `""`. An absent author is the supported blank, and the
  wallpaper then draws no author line and no gap for it.
- Record any punctuation you normalise in `edit`, down to a comma.

`references/example-owner-supplied.json` is a full worked example. Those five
quotes already ship, so read it for the shape and never promote it again.

## The Timeless Test

A quote is timeless when nothing inside it dates it. Reject text that names a
year, an event, a war, an election, a company, a product, a website, an
institution, a current job title, or that frames itself as "in today's world".
The age of the source does not matter: a 1921 line about rivers and mountains is
timeless, a 2019 line about a startup is not.

## Rationalizations

| Thought                                                     | Reality                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "The Vietnamese slots are already full, so English is fine" | Both baseline runs said this and produced zero Vietnamese. The share is 70% of what you approve, not of the catalogue. |
| "Translating this quote gives me Vietnamese content"        | It gives you your own sentence under someone else's name. Source Vietnamese material instead.                          |
| "All 50 candidates are good, culling wastes them"           | Approving nearly all of them means you never had a choice. The surplus is what makes the cut real.                     |
| "The gate blocks my batch, so the gate needs updating"      | A baseline run edited seven files to fit its harvest. The gate is the app's contract, not a variable.                  |
| "I verified these myself, a reviewer is ceremony"           | You cannot see your own confirmation bias. One fake quote on a wallpaper is a permanent, shareable error.              |
| "Wikiquote shows it, so it has a source"                    | Only its cited entries do. An uncited Wikiquote line is an aggregator line.                                            |
| "The author is public domain, so the text is"               | Translations carry their own copyright. Use a public-domain translation or write your own rendering.                   |
| "It is only one quote, I will add it directly"              | A direct write skips provenance. An entry with no recorded source cannot be defended later.                            |

## Red Flags - Stop

- You are about to open `assets/data/quotes.json` in an editor
- You are about to change a count or a rule in `scripts/verify-data.mjs`
- Your approved list is more than half your candidates
- Your approved list is mostly English
- A candidate's `verification` is `weak` and you are keeping it
- You are writing Vietnamese text for a quote that was written in English

All of these mean: go back to Step 1.
