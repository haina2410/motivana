---
name: sourcing-backgrounds
description: Use when the Motivana wallpaper library needs background images - adding or refreshing entries in assets/data/backgrounds.json, choosing a stock or museum image source, judging whether an image licence permits a wallpaper app, or estimating the bundle size that images add to the app.
---

# Sourcing Backgrounds

## Overview

Motivana composites a quote over a background and outputs a designed wallpaper.
That one fact decides every licence question in this skill: the image is an
ingredient, never the product.

**Core principle: public domain, fetched from the archive that holds it.**
Free stock sites carry a restriction that a wallpaper app breaks. Museum and
government archives do not. Go to the archive.

## The Licence Trap

The two most obvious sources both forbid this app's core use by name.

**Pexels:** "Don't redistribute or sell the photos and videos on other stock
photo or **wallpaper platforms**."

**Unsplash:** "This license does not include the right to compile photos from
Unsplash to replicate a similar or **competing service**."

So the line is whether the photo stays a photo:

| Shipping shape                                   | Verdict                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| Photo composited under a quote, as one template  | Allowed — derivative work                        |
| Photo offered on its own, user picks and sets it | **Forbidden** — you are now a wallpaper platform |

A "browse backgrounds" screen that lets a user apply a bare image breaks both
licences on the same day it ships. If a feature request heads that way, say so
before the images are chosen, not after.

## Never Do These

- **Never build the catalogue on Unsplash, Pexels, or Pixabay.** They are a
  top-up for a composited template at most, and they are never worth the
  audit risk when public domain covers the same ground.
- **Never ship an image without a manifest row.** Source, source ID, creator,
  licence, source URL and fetch date. App review asks; so will you, in a year.
- **Never trust a "free" badge.** Read the licence of the specific collection,
  not the site. Rawpixel is public domain in one collection and restricted in
  every other.
- **Never scrape HTML when the archive has an API.** All the sources below have
  one, and the API terms are what bind you.
- **Never promise modern photography from a public-domain search.** See below.

## Three Routes to an Unrestricted Image

Do not conflate these. They have different content and different ages.

| Route                           | How it becomes free                    | Age of the content                                 |
| ------------------------------- | -------------------------------------- | -------------------------------------------------- |
| **Public domain by age**        | Copyright expired                      | Pre-1931 only — paintings, prints, old photographs |
| **Public domain by authorship** | US government work is PD from creation | **Modern** — NASA, NPS, USGS, NOAA                 |
| **CC0 by dedication**           | A living creator waived every right    | **Modern** — can be a photo taken last year        |

**CC0 is the route to modern photography, and it carries no competing-service
clause.** That is what separates it from the Unsplash and Pexels licences: CC0
extinguishes copyright rather than granting a conditional permission, so it does
not — and legally cannot — forbid a wallpaper gallery. A CC0 image may ship as a
bare, user-selectable wallpaper. An Unsplash image may not.

Reach for museums when the vintage look is wanted, and for CC0 or government
photography when a modern one is.

## Public Domain By Age Means Old

In the US a work is public domain by age when published before 1931. There is no
modern, sharp landscape photograph in _this_ category, and there will not be one
for decades. A plan that asks for "15 mountain photos, 10 ocean photos,
10 lifestyle photos" cannot be filled from museum archives — use the CC0 and
government routes above for those.

What the archives actually hold is paintings, woodblock prints, engravings,
botanical plates and pre-1930 monochrome photography — plus NASA, which is
modern and public domain because it is US government work.

Treat this as the app's visual identity rather than a shortfall. A quote over a
Hiroshige or a Turner does not look like the fifty other quote apps drawing on
the same stock library.

| Category       | Available? | Where it comes from                                     |
| -------------- | ---------- | ------------------------------------------------------- |
| `mountain`     | Yes        | Hiroshige, Hokusai, Hudson River School                 |
| `ocean`        | Yes        | Hokusai, Winslow Homer, Dutch seascape                  |
| `sky`          | Yes        | Turner, Monet, Inness                                   |
| `cosmos`       | Yes        | NASA — real modern photography                          |
| `botanical`    | Yes        | Japanese flower prints, botanical plates                |
| `texture`      | Yes        | Marbled paper, textile, Art Nouveau                     |
| `nocturne`     | Yes        | Whistler, Munch, night landscape                        |
| `architecture` | Yes        | Engravings, pre-1930 photography                        |
| `lifestyle`    | **No**     | Drop it. Modern people photography is not public domain |

## Sources

Tested and current. Full API recipes in `references/archive-apis.md`.

### Modern CC0 and government photography

| Source                                   | Key       | Note                                                                                                                                                                                                        |
| ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wikimedia Commons**                    | No        | **Start here.** Keyless, no rate-limit trouble, and the licence is machine-readable in the API response — Commons _is_ the origin, so there is no aggregator to second-guess                                |
| **Pixabay, published before 2019-01-09** | No        | That cohort is **irrevocably CC0**; Pixabay's own terms still acknowledge it. Anything published on or after that date falls under the restricted Pixabay License — check the published date, not the badge |
| **Flickr, CC0-filtered**                 | Yes, free | Photographer-set licence, and the origin page states it                                                                                                                                                     |
| **Openverse**                            | No        | Search layer over the above. Tiny anonymous quota — see the reference file                                                                                                                                  |
| NASA                                     | No        | Space and Earth-from-orbit                                                                                                                                                                                  |
| NPS, USGS, NOAA                          | No        | National parks, terrain, ocean and sky — modern, PD by authorship                                                                                                                                           |

**Early Unsplash photographs survive on Commons as genuine CC0.** Unsplash used
CC0 before mid-2017, and thousands of those files were mirrored to Commons with
the dedication intact. A verified example carried
`UsageTerms: Creative Commons Zero, Public Domain Dedication`, a 2016 capture
date, and a Credit field linking Wayback snapshots as evidence. A CC0 dedication
cannot be withdrawn, so Unsplash's later licence does not reach these files —
but rely on the Commons record, not on the photo's Unsplash page today.

**Verify at the origin, never at the aggregator.** Open the `foreign_landing_url`
and confirm it links to `creativecommons.org/publicdomain/zero/1.0/`. Aggregators
inherit upstream metadata mistakes, and a wrong CC0 tag is not a defence.

CC0 waives copyright. It does **not** cure a dedication made by someone who did
not own the photo, a missing model release for an identifiable face, or a
trademark in frame. Keep the provenance row regardless.

### Public-domain-by-age archives

| Source                | Key | Login                       | Note                                                        |
| --------------------- | --- | --------------------------- | ----------------------------------------------------------- |
| Met Museum            | No  | No                          | `isPublicDomain` flag, original-resolution file             |
| Art Institute Chicago | No  | No                          | `is_public_domain` flag, IIIF sizing                        |
| NASA Image Library    | No  | No                          | `images-api.nasa.gov` — not `api.nasa.gov`                  |
| Library of Congress   | No  | No                          | **Needs a real User-Agent or returns 503**                  |
| Rijksmuseum           | No  | No                          | Legacy API dead since 2026-01-05; use `data.rijksmuseum.nl` |
| Openverse             | No  | No                          | Aggregator; filter to CC0                                   |
| Smithsonian           | Yes | api.data.gov, free, instant | Only if botanical needs more                                |
| Biodiversity Heritage | Yes | Free signup                 |                                                             |
| NYPL                  | Yes | Token by request            |                                                             |
| Rawpixel              | —   | **Login, 100/month**        | Browse to pick a look; download from the origin archive     |

The first four cover most of the catalogue and need no credential at all.
Prefer a pipeline with no secrets in the repo or CI.

## Choosing an Image

The quote sits in the middle of the frame. Judge every candidate on that band,
and judge it with a script — not by eye, and not by trusting the thumbnail.

1. **Quiet text zone.** Luminance standard deviation across `y = 0.35–0.65`
   must be low. Busy detail there is an automatic reject.
2. **Contrast headroom.** Mean luminance of that band outside `0.35–0.65`, so
   either white or black type is certainly legible.
3. **Resolution — filter on height, never on orientation.** The output is
   1290×2796, so a crop needs `height ≥ 2600` and `width ≥ height/2.168`. A
   landscape 6000×4000 photo yields a 1845×4000 crop, which is ample. Filtering
   for portrait sources instead throws away almost the entire corpus, because
   landscape photography is shot in landscape orientation — one such filter cut
   a seven-category sweep down to a single usable result.
4. **Croppable to 9:16.** Paintings are the exception where orientation matters:
   prefer portrait works such as Japanese woodblock, or landscapes with open sky.
5. **No text in the image.** Posters and engravings carry lettering that fights
   the quote — and so does the _scan_, which is the trap. Museum captures
   include the paper margin, the plate mark, and often a pencil signature in the
   lower border. A crop that reaches the edge of the frame lands on them.

Record the measurements from 1 and 2 in the manifest. The renderer picks the
type colour from them instead of a human tuning ninety entries by hand.

### Reject These Media Outright

Verified against rendered samples, not guessed:

| Medium                         | Verdict                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Etching, engraving, drypoint   | **Reject.** Dense hatching leaves no quiet band at any crop, and it is the most expensive thing to encode |
| Japanese woodblock print       | Keep — flat colour, generous empty areas, cheap to encode                                                 |
| Astronomical photography       | Keep — the best of the set; dark, quiet, white type sings                                                 |
| Pre-1930 landscape photography | Keep when the sky band is open                                                                            |
| Oil painting                   | Case by case; watch for canvas texture inflating the file                                                 |
| Decorative "wallpaper" panels  | Check the image, not the title — many are full scenes with figures                                        |

### Do Not Let the Scorer Pick an Edge Crop

Scoring purely for a quiet band drives the crop window to the very top or
bottom of the plate, which is exactly where the margin and the signature live.
Constrain the search to interior offsets, or add an explicit penalty as the
offset approaches 0.0 and 1.0. A run that returns `cropOffsetY` of exactly 0.00
or 1.00 for most images has this bug.

Trim a few percent off every edge of a museum scan before scoring at all.

## The Pipeline

`scripts/build_backgrounds.py` implements all of it. Every gotcha in this skill
and in the reference file is already encoded there — run it rather than writing
the pipeline again.

```bash
python3 scripts/build_backgrounds.py all --work ./bg --repo /path/to/repo
```

Five stages, each cached, so a re-run resumes instead of restarting:

```
harvest   search Commons, keep CC0/PD files tall enough to crop
score     fetch an 800px render of each candidate, rate its quote band
build     fetch a 4200px render of the winners, crop 9:16, encode WebP
template  derive per-image typography, write the catalogue and the images
sync      drop catalogue entries whose image a reviewer deleted
```

Scoring at 800px first is what keeps the harvest cheap: a few hundred
candidates cost a small thumbnail each, and only the ~90 winners are fetched
at full size.

Run a single stage by name — `template` alone re-derives typography from crops
already on disk, without touching the network. The output is deterministic:
running it twice gives a byte-identical catalogue.

## Deleting a Background Is the Review

No scorer can judge subject matter, so a human has to look at the set and throw
images out. The gesture for that is deleting the file. The folder, not the
catalogue, is therefore the record of what survived.

Two things follow, and the script does both:

- `sync --repo <path>` rewrites the catalogue and the asset module from
  whatever images remain. It reads nothing but the repo, so a review months
  later needs no harvest cache.
- `template` treats a non-empty image folder as an allow-list. Without this a
  re-run silently restores every image the reviewer deleted.

Ids stay as they were, so the numbering ends up with gaps. Leave them. Renaming
to close a gap rewrites the id of an image a user may already have set as their
wallpaper.

A catalogue and a folder that disagree fail quietly in both directions: an
entry with no file is a dangling `require()` that breaks the bundle, and a file
with no entry ships bytes the app can never show. Keep a test that compares the
two.

Needs Pillow and `cwebp`. Neither is an app dependency; this is skill tooling
run by hand, not part of the build.

### Importing One Image the Owner Supplied

An image the owner hands over skips the harvest and every licence question in
this skill - they hold it. The `import` stage adds one file straight to the
repo, additively:

```bash
python3 scripts/build_backgrounds.py import --repo /path/to/repo \
    --image ~/Pictures/dune.jpg --category texture --title "Dune at dusk"
```

It runs the same crop search, band measurement, typography derivation and
safe-strip placement as `template`, so the entry it writes is
indistinguishable in shape from a harvested one. Two differences: `source`
records `provider: "owner"` and `license: "owner-supplied"`, and an image that
is already 9:16 is kept whole rather than cropped, because the owner framed it.

The id is the next free number in the category, never a gap-fill. Nothing
existing is renumbered. The `import-content` skill is the front door for this.

## Manifest Row

```json
{
  "id": "hiroshige-fuji-01",
  "category": "mountain",
  "file": "backgrounds/hiroshige-fuji-01.webp",
  "source": "metmuseum",
  "sourceId": "45678",
  "sourceUrl": "https://www.metmuseum.org/art/collection/search/45678",
  "creator": "Utagawa Hiroshige",
  "license": "CC0",
  "retrievedAt": "2026-08-26",
  "textZone": { "y": 0.52, "luminance": 0.21, "variance": 0.04 },
  "preferredTextColor": "#FFFFFF"
}
```

`WallpaperBackground` in `src/features/wallpaper/types.ts` currently admits only
`solid` and `linear-gradient`. Adding images means a third variant. The existing
optional `overlay` field on `WallpaperPreset` is where the darkening scrim goes.

## Budget

Images do not compress further inside an APK or IPA. Bundle size is the base app
plus the sum of the files.

**Subject matter drives size more than the encoder setting does.** Measured at
WebP q80 @ 1290×2796 across eight real archive images:

| Subject                           | Per image  | 90 images |
| --------------------------------- | ---------- | --------- |
| Etching, engraving, fine hatching | 500–660 KB | ~50 MB    |
| Oil painting, canvas texture      | 300–570 KB | ~35 MB    |
| Woodblock print, flat colour      | 240–310 KB | ~25 MB    |
| Astronomical photography, dark    | ~310 KB    | ~28 MB    |
| Flat gradient or plain texture    | 20–60 KB   | ~4 MB     |

A mixed set of eight averaged 370 KB, which projects to **~33 MB for 90** — not
the ~22 MB a naive 250 KB estimate gives. Fine line detail is the worst case for
WebP: it is both the least legible under type and the most expensive to ship,
so rejecting engravings pays twice.

Store ceilings are far above this — Play and iOS both allow roughly 200 MB — so
the real cost is install conversion, not a limit. If the bundle needs to stay
small, ship a starter set and fetch the rest from a CDN on first use.

## Combinations

Backgrounds times presets is not the number of usable wallpapers. Thin type on a
busy painting, or dark type on a nocturne, is a broken frame. Gate the pairing
in the manifest — `preferredTextColor` at minimum, `compatiblePresets` when a
background is fussy — and quote the gated number, not the product.

## Common Mistakes

| Mistake                                  | Fix                                                        |
| ---------------------------------------- | ---------------------------------------------------------- |
| Curl to Library of Congress returns 503  | Set a User-Agent with a contact email                      |
| Rijksmuseum API returns 410              | Legacy endpoint is retired; use `data.rijksmuseum.nl`      |
| Met search has no public-domain filter   | Filter on `isPublicDomain` after fetching each object      |
| Thumbnail looks fine, full image is busy | Score the full file, never the thumbnail                   |
| Bulk downloading from Rawpixel           | 100/month cap; find the work in the origin archive instead |

## Keep the Quote Clear of System UI

A wallpaper is not a poster: the lock screen draws its own furniture on top.

| Strip  | Fraction of height | What lands there                                                                                    |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| Top    | up to **0.30**     | Android 12+ large lock-screen clock — the tallest offender; the iOS clock and date stop nearer 0.22 |
| Bottom | from **0.84**      | Shortcut row, flashlight and camera buttons, home indicator                                         |

The constraint is on the **whole text block**, not on `quotePositionY`. Compute
the block from the entry's own metrics and check both edges:

```
blockHeight = preferredFontSizeRatio × (3 × lineHeight + 0.7)
top    = quotePositionY − blockHeight / 2   must be ≥ 0.30
bottom = quotePositionY + blockHeight / 2   must be ≤ 0.84
```

The `3` is the longest quote the renderer lays out; the `0.7` is the author
line and its gap.

Letting a band-scoring pass roam the full frame breaks this every time — an
unconstrained scan put 28 of 90 entries into the clock strip. Constrain the
search to the safe centre range instead of filtering afterwards.

**Round before you nudge.** `quotePositionY` is stored to three decimals, so a
value that passed the check at full precision can fail once rounded. Round
first, then step the centre inward until the recomputed block fits, and assert
with the same arithmetic the test uses. Skipping this put 20 of 90 entries a
few ten-thousandths over the line.

For reference, the eight gradient presets in `assets/data/presets.json` sit
between 0.39 and 0.47. Those predate this rule and sit slightly higher than it
allows.
