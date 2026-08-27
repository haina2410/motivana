# Archive API Recipes

Every command below was run and returned `200` unless noted. Set this first:

```bash
UA="Motivana/1.0 (nam.dinh@ascenda.com)"
```

Send it on every request. Library of Congress rejects the default curl agent,
and the other archives ask for a contact address in their terms.

---

## Art Institute of Chicago — start here

No key. One call returns the public-domain flag, the full-image dimensions and
the IIIF id, so candidates can be filtered without a second round trip.

```bash
curl -s -A "$UA" -H "AIC-User-Agent: $UA" \
  "https://api.artic.edu/api/v1/artworks/search?q=mountain+landscape&fields=id,title,artist_title,image_id,is_public_domain,thumbnail&limit=25" \
| jq -r '.data[]
    | select(.is_public_domain==true and .image_id!=null and .thumbnail!=null)
    | select(.thumbnail.width>=1400 and .thumbnail.height>=1400)
    | [(.id|tostring), .image_id, (.thumbnail.width|tostring), (.thumbnail.height|tostring), (.artist_title//"Unknown"), .title]
    | @tsv'
```

`thumbnail.width` / `.height` are the dimensions of the **full** image, not the
thumbnail. Use them to reject anything too small before downloading.

Image download is IIIF. Two separate rules, both of which return `403`:

**1. The `AIC-User-Agent` header is required on the image host too**, not only
on the API. Without it the host answers `403` with a "Just a moment..."
Cloudflare page. A browser-like User-Agent does not help; only the header does.

**2. Never request a width larger than the source, and never use `full/full`.**
The server refuses upscaling with `403`, and `full/full` is blocked outright.
Clamp the request to `thumbnail.width` from the search response:

```bash
W=$(( src_width < 2400 ? src_width : 2400 ))
curl -sS -A "$UA" -H "AIC-User-Agent: $UA" \
  --retry 4 --retry-all-errors --retry-delay 3 -C - --max-time 180 \
  -o out.jpg "https://www.artic.edu/iiif/2/<image_id>/full/$W,/0/default.jpg"
```

Measured on one image with a 1846px-wide source: `full/1846,` → `200`,
`full/1800,` → `200`, `full/2400,` → `403`, `full/full` → `403`.

Always check the byte count. A ~3 KB response is the challenge page, and curl
will happily write it over your file. Reject anything under 20 KB and retry.

Large files drop mid-transfer often enough to matter — use `--retry-all-errors`
with `-C -` so a resumed request finishes rather than restarting.

Queries that returned good portrait-croppable results: `mountain+landscape`,
`seascape+waves`, `sunset+sky`, `night+nocturne`, `flowers+woodblock+print`,
`marbled+paper+pattern`, `architecture+facade`.

---

## Met Museum

No key. Search returns bare object IDs, so each candidate costs a second call —
budget for it and cache the results.

```bash
# 1. search
curl -s -A "$UA" \
  "https://collectionapi.metmuseum.org/public/collection/v1/search?q=hiroshige&hasImages=true" \
| jq '.objectIDs[:40]'

# 2. fetch each, keep the public-domain ones
curl -s -A "$UA" \
  "https://collectionapi.metmuseum.org/public/collection/v1/objects/45678" \
| jq '{objectID, isPublicDomain, primaryImage, artistDisplayName, title, objectURL}'
```

There is **no public-domain filter on the search endpoint**. Filter on
`isPublicDomain` after fetching the object.

`primaryImage` is the original resolution. `primaryImageSmall` is a web-large
render, usually too small once cropped to 9:16.

**Originals are big — a sampled file was 5.6 MB against 282 KB for web-large.**
Ninety of them is roughly half a gigabyte of transfer, and a naive loop will
blow a two-minute command timeout on a handful of images. Check `content-length`
with `curl -sI` before committing to a download, fetch in the background, and
keep the originals in a scratch directory rather than the repo.

The Met tolerates fast access, but stay near 5–10 requests per second.

---

## NASA — the only modern photography here

No key. Note the host: `images-api.nasa.gov` is keyless, while `api.nasa.gov`
(APOD and friends) requires one.

```bash
curl -s -A "$UA" \
  "https://images-api.nasa.gov/search?q=nebula&media_type=image&year_start=2010" \
| jq -r '.collection.items[] | [.data[0].nasa_id, .data[0].title] | @tsv'
```

`items[].href` is a `collection.json` listing the renditions. Fetch it and take
the `~orig.jpg` entry:

```bash
curl -s -A "$UA" "<items[].href>" | jq -r '.[] | select(endswith("~orig.jpg"))'
```

The URLs inside `collection.json` come back as `http://`. Rewrite to `https://`
before fetching.

NASA imagery is public domain, with two conditions: do not imply NASA
endorsement, and do not use the NASA insignia.

---

## Library of Congress

No key, but the default curl User-Agent gets `503`. With `-A` set it returns
`200`.

```bash
curl -s -A "$UA" "https://www.loc.gov/photos/?q=mountain&fo=json" \
| jq -r '.results[] | [.id, .title] | @tsv'
```

`fo=json` is what switches the site to an API. Rights vary per item — read
`rights` or `rights_advisory` on each record; not everything on loc.gov is
public domain.

---

## Rijksmuseum

The legacy endpoint `www.rijksmuseum.nl/api/...` returns **410 Gone**. It was
retired on 2026-01-05. Any guide telling you to register for a Rijksstudio API
key is out of date.

The replacement at `data.rijksmuseum.nl` needs **no key**. Parameter names
changed — `pageSize` is rejected, for one — so read `https://data.rijksmuseum.nl/docs/`
before writing the query.

---

## Openverse

No key, but the anonymous quota is small — **roughly a couple of dozen queries
before Cloudflare starts answering with a "Just a moment..." challenge page**
instead of JSON. Register for a free key before any real harvest.

```bash
curl -s -A "$UA" "https://api.openverse.org/v1/images/?q=mountain&license=cc0&aspect_ratio=tall"
```

**The failure is silent and looks like success.** A naive client parses the
challenge page, throws, and reports zero results — so a rate-limited run is
indistinguishable from "this query has no matches". Check that the response body
starts with `{` and raise on anything beginning with `<`, or you will spend an
hour widening queries that were never the problem.

Filter notes: `aspect_ratio=tall` is the useful one for 9:16. Do **not** combine
`source=flickr` with `size=large` — Flickr records carry no size metadata in
Openverse, so that pair always returns zero.

Verify the licence on the origin record before shipping. Openverse indexes other
people's metadata and inherits their mistakes. One sampled `cc0` record did
check out against its Flickr origin page, which linked
`creativecommons.org/publicdomain/zero/1.0/` — but sample, do not assume.

**StockSnap cannot be verified at origin.** Its pages and licence page both
answer `403` to scripted requests, so an Openverse `cc0` claim on a StockSnap
record is unconfirmable. Prefer Flickr, Wikimedia Commons, or a government
source, where the licence is machine-readable.

---

## Sources that need a credential

| Source                        | How to get access                          | Failure without it    |
| ----------------------------- | ------------------------------------------ | --------------------- |
| Smithsonian Open Access       | Free key at api.data.gov, issued instantly | `403 API_KEY_MISSING` |
| Biodiversity Heritage Library | Free signup                                | `unauthorized`        |
| NYPL Digital Collections      | Token by request form                      | —                     |

Only reach for these if `botanical` or `texture` runs short from the Met and the
Art Institute. Keeping the pipeline credential-free is worth more than the
marginal coverage.

---

## Rawpixel

Good for browsing a look, bad as a fetch target: login required, 100 downloads
per month on the free tier, 1 per day without an account. Its public-domain
collection is re-hosted from the Met, Rijksmuseum, Smithsonian, NYPL and the
Biodiversity Heritage Library.

Find the piece you like there, then search the artist and title in the origin
archive and download it from there. Higher resolution, no download cap, and no
Rawpixel User Terms to accept.

Only their collection marked **Public Domain / CC0** is unrestricted. The rest
of Rawpixel forbids redistributing raw content and forbids use in a gallery
others can draw from — which is what this catalogue is.

---

## Wikimedia Commons — the modern CC0 workhorse

No key, no login, and the licence arrives inside the search response, so no
second call and no aggregator to distrust.

```bash
curl -s -A "$UA" "https://commons.wikimedia.org/w/api.php?\
action=query&generator=search&gsrsearch=filetype:bitmap%20mountain%20fog&\
gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&\
iiextmetadatafilter=LicenseShortName%7CArtist&format=json&formatversion=2"
```

Keep `iiextmetadatafilter`. Without it the full `extmetadata` block makes the
response big enough that the connection drops mid-read — six of seven queries
failed with `IncompleteRead` until it was added.

Accept a file when `extmetadata.LicenseShortName` matches
`^(cc0|public domain|pd|no restrictions)`.

**Do not download `imageinfo.url` — it is the original.** Commons originals run
to 10–30 MB and time out even at a 240-second budget. Ask for a sized render
instead, via `iiurlwidth` on a second lookup, and take `thumburl`:

```bash
curl -s -A "$UA" "https://commons.wikimedia.org/w/api.php?\
action=query&titles=File:Sky%20Clouds%20Sea.jpg&prop=imageinfo&\
iiprop=url%7Csize&iiurlwidth=4200&format=json&formatversion=2"
```

Pick the width from the height you need, not the width you want: for a
1290×2796 output the crop needs ~2800px of height, so a 3:2 landscape wants
`iiurlwidth=4200`. Commons caps the render at 3840px wide, which still gives
2560px of height — close enough that the upscale is invisible.

Download the thumb with `curl --retry 5 --retry-all-errors -C -`. The upload
host drops the tail of large responses often enough that plain `urlopen` fails
on most files.
