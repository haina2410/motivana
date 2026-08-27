#!/usr/bin/env python3
"""
Build the Motivana background catalogue from Wikimedia Commons.

Four stages, each cached on disk so a re-run resumes rather than restarts:

    harvest   search Commons, keep CC0/PD files big enough to crop
    score     fetch an 800px render of each candidate and rate its quote band
    build     fetch a 4200px render of the winners, crop, encode WebP
    template  derive the per-image typography and write the catalogue

Plus one stage that stands outside the harvest:

    import    add a single image the owner supplied, straight into the repo

Usage:
    python3 build_backgrounds.py all      --work ./bg --repo /path/to/repo
    python3 build_backgrounds.py harvest  --work ./bg
    python3 build_backgrounds.py template --work ./bg --repo /path/to/repo
    python3 build_backgrounds.py import   --repo /path/to/repo \
        --image ~/Pictures/dune.jpg --category texture

Requires Pillow and cwebp. Neither is an app dependency — this is skill
tooling, run by hand, not part of the build.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageStat

UA = "Motivana/1.0 (nam.dinh@ascenda.com)"
API = "https://commons.wikimedia.org/w/api.php"

# Output geometry.
TW, TH = 1290, 2796
EDGE = 0.03          # trim off every side before scoring: museum and press
                     # scans carry margins, plate marks and pencil signatures

# The lock screen keeps two strips. Above, the Android 12+ large clock is the
# tallest thing that lands there. Below, the shortcut row and home indicator.
CLOCK_SAFE_TOP = 0.30
BOTTOM_SAFE = 0.84
MAX_LINES = 3        # longest quote the renderer lays out
AUTHOR_LINES = 0.7   # author line plus its gap, in units of font size

# An image that scores "perfectly" because it is blank is still useless.
MIN_BAND_VARIANCE = 0.030
MIN_WHOLE_VARIANCE = 0.080

LICENCE_OK = re.compile(r"^(cc0|public domain|pd|no restrictions)", re.I)

TARGET = {
    "mountain": 12, "ocean": 12, "sky": 12, "cosmos": 12,
    "texture": 12, "botanical": 10, "nocturne": 10, "architecture": 10,
}

QUERIES = {
    "mountain": ["mountain fog", "misty mountain", "mountain mist morning",
                 "foggy peak", "alpine fog valley"],
    "ocean": ["sea fog", "calm sea horizon", "misty lake water", "ocean mist",
              "long exposure sea", "still lake morning"],
    "sky": ["sunset clouds", "clouds dusk sky", "pastel sunset sky",
            "cloudscape", "gradient sky twilight"],
    "cosmos": ["nebula hubble", "milky way galaxy", "star field deep space",
               "galaxy spiral", "star cluster space"],
    "texture": ["sand dune", "snow surface", "dune desert minimal",
                "ice texture", "sand ripples"],
    "botanical": ["misty forest", "forest fog trees", "bamboo grove",
                  "fern leaves", "forest path fog", "moss forest"],
    "nocturne": ["starry night sky", "milky way night", "aurora night",
                 "night dark forest", "moonlit landscape night"],
    "architecture": ["minimalist architecture", "modern facade building",
                     "concrete architecture", "building against sky"],
}


# --------------------------------------------------------------------------
# Commons API
# --------------------------------------------------------------------------

def api(params, tries=3):
    """Commons returns an HTML challenge page under load. That parses as a
    failure rather than as an error, so a rate-limited run looks exactly like
    an empty result set. Detect it explicitly."""
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": UA})
            raw = urllib.request.urlopen(request, timeout=60).read()
            if raw[:15].lstrip().startswith(b"<"):
                raise RuntimeError("HTML challenge page, not JSON")
            return json.loads(raw)
        except Exception as error:                       # noqa: BLE001
            if attempt == tries - 1:
                print(f"  api error: {error}", file=sys.stderr)
                return {}
            time.sleep(2 * (attempt + 1))
    return {}


def render_urls(titles, width):
    """Map file titles to a sized render.

    Never download `imageinfo.url` — that is the original, which on Commons
    runs to 10-30 MB and times out. Pick the width from the height you need:
    a 1290x2796 crop wants ~2800px of height, so a 3:2 landscape wants 4200.
    Commons caps the render at 3840 wide, which is close enough.
    """
    out = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        data = api(dict(action="query",
                        titles="|".join("File:" + t for t in chunk),
                        prop="imageinfo", iiprop="url|size",
                        iiurlwidth=width, format="json", formatversion=2))
        for page in (data.get("query", {}).get("pages") or []):
            info = (page.get("imageinfo") or [{}])[0]
            if info.get("thumburl"):
                out[page["title"][5:]] = info["thumburl"]
        time.sleep(0.3)
    return out


def download(url, dest, min_bytes=8000):
    """curl, not urlopen: the upload host drops the tail of large responses
    often enough that a plain read fails on most files. --retry with -C -
    resumes instead of restarting."""
    subprocess.run(["curl", "-sS", "-A", UA, "--retry", "5",
                    "--retry-all-errors", "--retry-delay", "2", "-C", "-",
                    "--max-time", "180", "-o", dest, url],
                   capture_output=True, check=False)
    return os.path.exists(dest) and os.path.getsize(dest) > min_bytes


# --------------------------------------------------------------------------
# Image measurement
# --------------------------------------------------------------------------

def block_height(size_ratio, line_height):
    return size_ratio * (MAX_LINES * line_height + AUTHOR_LINES)


def band_stats(grey, centre, height_fraction):
    w, h = grey.size
    band = int(height_fraction * h)
    top = max(0, min(h - band, int(h * centre - band / 2)))
    stat = ImageStat.Stat(grey.crop((0, top, w, top + band)))
    return stat.mean[0] / 255.0, stat.stddev[0] / 255.0


def best_crop(image, edge=EDGE):
    """Choose the 9:16 window whose quote band is calmest.

    Two constraints matter and are easy to get wrong. Trim the edges first,
    or the search drifts onto the scan margin and the signature. Then keep the
    window interior: scoring purely for a quiet band pins it to the very top or
    bottom of the plate, which is exactly where those artefacts live.

    Pass `edge=0` for a photograph the owner framed themselves: it carries no
    margin to trim, so trimming only crops the composition they chose.
    """
    w, h = image.size
    if edge:
        image = image.crop((int(w * edge), int(h * edge),
                            int(w * (1 - edge)), int(h * (1 - edge))))
    w, h = image.size
    cw, ch = int(h * TW / TH), h
    if cw > w:
        cw, ch = w, int(w * TH / TW)
    best = None
    for fy in [i / 16 for i in range(3, 14)]:        # 0.19 .. 0.81
        for fx in [i / 8 for i in range(2, 7)]:      # 0.25 .. 0.75
            left, top = int((w - cw) * fx), int((h - ch) * fy)
            crop = image.crop((left, top, left + cw, top + ch))
            grey = crop.convert("L")
            mean, band_var = band_stats(grey, 0.5, 0.30)
            whole_var = ImageStat.Stat(grey).stddev[0] / 255.0
            edge = max(abs(fy - 0.5), abs(fx - 0.5))
            score = band_var - 0.55 * abs(mean - 0.5) + 0.10 * edge
            if best is None or score < best[0]:
                best = (score, fx, fy, crop, mean, band_var, whole_var)
    return best


def font_for(variance):
    """Thin serif reads beautifully on a calm frame and falls apart on a busy
    one. Sans holds up where the background has texture."""
    if variance < 0.075:
        return "CormorantGaramond", "Light", 0.070, 1.36
    if variance < 0.115:
        return "Lora", "Regular", 0.064, 1.42
    if variance < 0.160:
        return "CormorantGaramond", "Regular", 0.061, 1.40
    return "BeVietnamPro", "Light", 0.056, 1.48


def safe_centre(grey, height):
    """Calmest quote centre that keeps the whole block clear of system UI."""
    lo, hi = CLOCK_SAFE_TOP + height / 2, BOTTOM_SAFE - height / 2
    if hi < lo:
        lo = hi = (CLOCK_SAFE_TOP + BOTTOM_SAFE) / 2
    best = None
    for i in range(41):
        centre = lo + (hi - lo) * i / 40
        mean, variance = band_stats(grey, centre, height)
        score = variance - 0.35 * abs(mean - 0.5)
        if best is None or score < best[0]:
            best = (score, centre, mean, variance)
    return best


# --------------------------------------------------------------------------
# Stages
# --------------------------------------------------------------------------

def stage_harvest(work):
    path = f"{work}/pool.json"
    if os.path.exists(path):
        return json.load(open(path))
    pool, seen = [], set()
    for category, queries in QUERIES.items():
        for query in queries:
            data = api(dict(action="query", generator="search",
                            gsrsearch=f"filetype:bitmap {query}",
                            gsrnamespace=6, gsrlimit=40, prop="imageinfo",
                            iiprop="url|size|extmetadata",
                            # without this filter the response grows large
                            # enough that the connection drops mid-read
                            iiextmetadatafilter="LicenseShortName|Artist",
                            format="json", formatversion=2))
            time.sleep(0.4)
            for page in (data.get("query", {}).get("pages") or []):
                info = (page.get("imageinfo") or [{}])[0]
                meta = info.get("extmetadata") or {}
                licence = (meta.get("LicenseShortName", {}) or {}).get("value", "").strip()
                w, h = info.get("width") or 0, info.get("height") or 0
                title = page["title"][5:]
                # Filter on height, never on orientation: landscape
                # photography is shot in landscape, and a 6000x4000 frame
                # still yields a 1845x4000 crop.
                if not LICENCE_OK.match(licence) or h < 2600 or w < h / 2.168:
                    continue
                if title in seen:
                    continue
                seen.add(title)
                artist = re.sub(r"<[^>]*>", "",
                                (meta.get("Artist", {}) or {}).get("value", "Unknown")).strip()
                pool.append(dict(cat=category, title=title, w=w, h=h,
                                 lic=licence, creator=artist[:40] or "Unknown",
                                 land=info.get("descriptionurl")))
        print(f"  {category}: {sum(1 for x in pool if x['cat'] == category)}", file=sys.stderr)
    json.dump(pool, open(path, "w"), indent=1, ensure_ascii=False)
    return pool


def stage_score(work, pool):
    path = f"{work}/scored.json"
    if os.path.exists(path):
        return json.load(open(path))
    os.makedirs(f"{work}/score", exist_ok=True)
    urls = render_urls([p["title"] for p in pool], 800)
    scored = []
    for i, entry in enumerate(pool):
        url = urls.get(entry["title"])
        if not url:
            continue
        thumb = f"{work}/score/{i}.jpg"
        if not os.path.exists(thumb) and not download(url, thumb, 4000):
            continue
        try:
            _, fx, fy, _, mean, band_var, whole_var = best_crop(
                Image.open(thumb).convert("RGB"))
        except Exception:                                # noqa: BLE001
            continue
        if band_var < MIN_BAND_VARIANCE or whole_var < MIN_WHOLE_VARIANCE:
            continue                                     # blank frame
        row = dict(entry)
        row.update(idx=i, fx=fx, fy=fy, lum=round(mean, 3),
                   var=round(band_var, 3), wvar=round(whole_var, 3),
                   score=round(band_var - 0.55 * abs(mean - 0.5), 4))
        scored.append(row)
        if i % 25 == 0:
            print(f"  scored {i}/{len(pool)}", file=sys.stderr)
    json.dump(scored, open(path, "w"), indent=1, ensure_ascii=False)
    return scored


def series_stem(title):
    """`night sky 02.jpg` and `night sky 03.jpg` are the same photograph twice."""
    stem = re.sub(r"\.[a-z]+$", "", title, flags=re.I)
    stem = re.sub(r"[\s_\-–]*(\(?\d{2,}\)?|[0-9]{1,2})$", "", stem).strip().lower()
    return re.sub(r"[^a-z0-9 ]+", "", stem)


def stage_build(work, scored, quality):
    os.makedirs(f"{work}/orig", exist_ok=True)
    os.makedirs(f"{work}/crop", exist_ok=True)
    picked = []
    for category, wanted in TARGET.items():
        seen, chosen = set(), []
        for entry in sorted((x for x in scored if x["cat"] == category),
                            key=lambda x: x["score"]):
            stem = series_stem(entry["title"])
            if stem in seen:
                continue
            seen.add(stem)
            chosen.append(entry)
            if len(chosen) == wanted:
                break
        if len(chosen) < wanted:
            print(f"  SHORT {category}: {len(chosen)}/{wanted}", file=sys.stderr)
        picked += chosen

    urls = render_urls([p["title"] for p in picked], 4200)
    rows, counts = [], {}
    for entry in picked:
        category = entry["cat"]
        counts[category] = counts.get(category, 0) + 1
        bid = f"{category}-{counts[category]:02d}"
        src, dst = f"{work}/orig/{bid}.jpg", f"{work}/crop/{bid}.webp"
        url = urls.get(entry["title"])
        if not url:
            continue
        if not (os.path.exists(src) and os.path.getsize(src) > 50000):
            if not download(url, src, 50000):
                print(f"  download failed: {bid}", file=sys.stderr)
                continue
        try:
            _, fx, fy, crop, mean, band_var, whole_var = best_crop(
                Image.open(src).convert("RGB"))
        except Exception as error:                       # noqa: BLE001
            print(f"  crop failed: {bid} {error}", file=sys.stderr)
            continue
        # Re-check at full resolution. The crop chosen here can differ from
        # the one the 800px pass chose, so a blank frame can still slip in.
        if band_var < MIN_BAND_VARIANCE or whole_var < MIN_WHOLE_VARIANCE:
            print(f"  blank at full res, dropped: {bid}", file=sys.stderr)
            continue
        crop.resize((TW, TH), Image.LANCZOS).save(f"{work}/tmp.png")
        subprocess.run(["cwebp", "-q", str(quality), "-m", "6",
                        f"{work}/tmp.png", "-o", dst], capture_output=True, check=False)
        rows.append(dict(id=bid, category=category, bytes=os.path.getsize(dst),
                         source="wikimedia", sourceUrl=entry["land"],
                         creator=entry["creator"], title=entry["title"],
                         license=entry["lic"], retrievedAt=time.strftime("%Y-%m-%d")))
        print(f"{bid:<18} var={band_var:.3f} {os.path.getsize(dst) // 1024:>4}KB", flush=True)
    json.dump(rows, open(f"{work}/built.json", "w"), indent=1, ensure_ascii=False)
    total = sum(r["bytes"] for r in rows)
    print(f"\nbuilt {len(rows)} images, {total / 1048576:.1f} MB", file=sys.stderr)
    return rows


def template_entry(grey, row):
    """Derive one catalogue entry from a finished 9:16 crop.

    Shared by `template` and `import` so the safe-strip arithmetic exists once.
    """
    # Pass one learns how busy the region is, which picks the font.
    _, _, _, nominal_var = safe_centre(grey, block_height(0.064, 1.42))
    family, weight, size, line_height = font_for(nominal_var)
    # Pass two re-scans with the block that font actually produces.
    height = block_height(size, line_height)
    _, centre, mean, variance = safe_centre(grey, height)
    # Round first, then nudge inward, so the stored three-decimal value
    # still satisfies the check when recomputed from the stored fields.
    centre = round(centre, 3)
    for _ in range(50):
        if centre - height / 2 < CLOCK_SAFE_TOP:
            centre = round(centre + 0.001, 3)
            continue
        if centre + height / 2 > BOTTOM_SAFE:
            centre = round(centre - 0.001, 3)
            continue
        break
    assert centre - height / 2 >= CLOCK_SAFE_TOP, row["id"]
    assert centre + height / 2 <= BOTTOM_SAFE, row["id"]

    dark = mean < 0.5
    opacity = round(min(0.82, max(0.40, 0.40 + 1.6 * variance)), 2)
    effective = round(mean * (1 - opacity) + (0.0 if dark else 1.0) * opacity, 3)
    return {
        "id": row["id"], "category": row["category"],
        "fontFamily": family, "fontWeight": weight, "textAlign": "center",
        "quotePositionY": centre,
        "textColor": "#FFFFFF" if effective < 0.5 else "#171717",
        "authorColor": "#D6DBE4" if effective < 0.5 else "#454545",
        "preferredFontSizeRatio": size,
        "minimumFontSizeRatio": round(size * 0.56, 3),
        "lineHeight": line_height,
        "background": {
            "kind": "image", "asset": f"backgrounds/{row['id']}.webp",
            "scrimColor": "#000000" if dark else "#FFFFFF",
            "scrimOpacity": opacity, "effectiveLuminance": effective,
        },
        "safeArea": {
            "blockTop": round(centre - height / 2, 4),
            "blockBottom": round(centre + height / 2, 4),
            "clockSafeTop": CLOCK_SAFE_TOP, "bottomSafe": BOTTOM_SAFE,
        },
        "source": {"provider": row["source"], "url": row["sourceUrl"],
                   "creator": row["creator"], "title": row["title"],
                   "license": row["license"], "retrievedAt": row["retrievedAt"]},
        "measured": {"bandLuminance": round(mean, 3),
                     "bandVariance": round(variance, 3), "bytes": row["bytes"]},
    }


def stage_template(work, rows, repo):
    # A rerun must never bring back an image a reviewer deleted, so the
    # repo folder acts as an allow-list once it holds anything.
    keep = kept_ids(repo) if repo else None
    if keep is not None:
        rows = [row for row in rows if row["id"] in keep]
    out = []
    for row in rows:
        grey = Image.open(f"{work}/crop/{row['id']}.webp").convert("L")
        out.append(template_entry(grey, row))
    json.dump(out, open(f"{work}/templates.json", "w"), indent=1, ensure_ascii=False)
    if repo:
        write_asset_module(repo, out)
        images = f"{repo}/assets/images/backgrounds"
        os.makedirs(images, exist_ok=True)
        for row in rows:
            src = f"{work}/crop/{row['id']}.webp"
            if os.path.exists(src):
                open(f"{images}/{row['id']}.webp", "wb").write(open(src, "rb").read())
        write_catalog(f"{repo}/assets/data/backgrounds.json", out)
        print(f"wrote {repo}/assets/data/backgrounds.json and {len(rows)} images",
              file=sys.stderr)
    return out


def next_id(repo, category):
    """The next free number in a category, from the catalogue and the folder
    together.

    Never fills a gap. A gap means an id that shipped once, and a user may have
    that wallpaper set right now -- handing the number to a different image
    changes the picture under them.
    """
    used = set()
    path = f"{repo}/assets/data/backgrounds.json"
    if os.path.exists(path):
        used |= {entry["id"] for entry in json.load(open(path))}
    used |= kept_ids(repo) or set()
    numbers = [int(match.group(1)) for identifier in used
               if (match := re.fullmatch(rf"{re.escape(category)}-(\d+)", identifier))]
    return f"{category}-{max(numbers, default=0) + 1:02d}"


def stage_import(repo, image, category, quality,
                 creator=None, title=None, url=None):
    """Add one image the owner supplied to the catalogue, in place.

    The rights questions the harvest asks do not apply: the owner holds these
    images, so there is no licence to read and no creator to credit. Every
    geometric step still runs, because a wallpaper whose quote lands under the
    lock-screen clock is broken whoever owns the photograph.

    Additive by construction. It reads the catalogue, inserts one entry, and
    renumbers nothing.
    """
    if category not in TARGET:
        raise SystemExit(f"category must be one of: {' '.join(sorted(TARGET))}")
    if not os.path.exists(image):
        raise SystemExit(f"no such image: {image}")

    source = Image.open(image).convert("RGB")
    w, h = source.size
    aspect, target_aspect = w / h, TW / TH
    if abs(aspect - target_aspect) / target_aspect < 0.02:
        # Already the output shape, so the owner framed it. Searching for a
        # calmer window here would crop away the framing they chose.
        crop = source
        grey = crop.convert("L")
        mean, band_var = band_stats(grey, 0.5, 0.30)
        whole_var = ImageStat.Stat(grey).stddev[0] / 255.0
        print(f"{image}: already 9:16, kept whole", file=sys.stderr)
    else:
        # edge=0: an owner's photograph has no scan margin or plate mark.
        _, fx, fy, crop, mean, band_var, whole_var = best_crop(source, edge=0)
        print(f"{image}: cropped to 9:16 at fx={fx:.2f} fy={fy:.2f}",
              file=sys.stderr)

    if crop.width < TW * 0.7:
        raise SystemExit(
            f"the 9:16 crop is only {crop.width}x{crop.height}, too small for "
            f"{TW}x{TH}: upscaling that far ships a blurry wallpaper")
    if crop.width < TW:
        print(f"  warning: upscaling {crop.width}x{crop.height} to {TW}x{TH}",
              file=sys.stderr)
    # A flat frame is a reject in a harvest, where it means the scorer found a
    # blank plate. From the owner it may be the whole point, so only say so.
    if band_var < MIN_BAND_VARIANCE or whole_var < MIN_WHOLE_VARIANCE:
        print(f"  note: very flat frame (band {band_var:.3f}, "
              f"whole {whole_var:.3f})", file=sys.stderr)

    bid = next_id(repo, category)
    images = f"{repo}/assets/images/backgrounds"
    os.makedirs(images, exist_ok=True)
    destination = f"{images}/{bid}.webp"
    temporary = f"{images}/.{bid}.png"
    crop.resize((TW, TH), Image.LANCZOS).save(temporary)
    subprocess.run(["cwebp", "-q", str(quality), "-m", "6",
                    temporary, "-o", destination],
                   capture_output=True, check=True)
    os.remove(temporary)

    row = dict(id=bid, category=category, bytes=os.path.getsize(destination),
               # The basename, never the absolute path: a home directory is
               # meaningless to the next reader and ships in the app bundle.
               source="owner", sourceUrl=url or os.path.basename(image),
               creator=creator or "Motivana", title=title or os.path.basename(image),
               license="owner-supplied", retrievedAt=time.strftime("%Y-%m-%d"))
    entry = template_entry(Image.open(destination).convert("L"), row)

    path = f"{repo}/assets/data/backgrounds.json"
    entries = json.load(open(path)) if os.path.exists(path) else []
    # Sit with the rest of the category rather than at the end of the file.
    after = max((index for index, existing in enumerate(entries)
                 if existing["category"] == category), default=len(entries) - 1)
    entries.insert(after + 1, entry)
    write_catalog(path, entries)
    write_asset_module(repo, entries)
    print(f"imported {bid} ({row['bytes'] // 1024} KB), "
          f"catalogue now {len(entries)} entries", file=sys.stderr)
    return entry


def write_catalog(path, entries):
    """Prettier guards the repo and expects a trailing newline, so write one
    rather than leave every regeneration failing the format check."""
    text = json.dumps(entries, indent=2, ensure_ascii=False)
    open(path, "w").write(text + "\n")


def kept_ids(repo):
    """The image ids a reviewer chose to keep.

    A background is removed by deleting its file, so the folder -- not the
    catalogue -- is the record of what survived review. Returns None when the
    folder holds nothing yet, which means no review has happened and every
    candidate should pass through."""
    folder = f"{repo}/assets/images/backgrounds"
    if not os.path.isdir(folder):
        return None
    ids = {name[:-5] for name in os.listdir(folder) if name.endswith(".webp")}
    return ids or None


def stage_sync(repo):
    """Drop catalogue entries whose image is gone, and rewrite the asset module.

    Runs off the repo alone, so a reviewer can delete images months later and
    resync without the harvest cache. Ids are stable, so gaps in the numbering
    are expected and harmless."""
    path = f"{repo}/assets/data/backgrounds.json"
    entries = json.load(open(path))
    keep = kept_ids(repo) or set()
    synced = [e for e in entries if e["id"] in keep]
    orphans = sorted(keep - {e["id"] for e in synced})
    if orphans:
        raise SystemExit(f"images with no catalogue entry: {' '.join(orphans)}")
    write_catalog(path, synced)
    write_asset_module(repo, synced)
    print(f"kept {len(synced)} of {len(entries)} entries", file=sys.stderr)
    return synced


def write_asset_module(repo, entries):
    """React Native resolves require() at build time, so every background needs
    a literal call in a checked-in module."""
    lines = [
        "// Generated by .claude/skills/sourcing-backgrounds/scripts/build_backgrounds.py.",
        "// React Native resolves require() at build time, so every background needs a",
        "// literal call here. Re-run the skill's `template` or `sync` stage to\n// regenerate it.",
        "",
        "export const backgroundAssets: Readonly<Record<string, number>> = {",
    ]
    for entry in entries:
        lines.append(f"  '{entry['id']}': "
                     f"require('../../../assets/images/backgrounds/{entry['id']}.webp'),")
    lines += ["};", ""]
    path = f"{repo}/src/features/wallpaper/backgroundAssets.ts"
    open(path, "w").write("\n".join(lines))
    print(f"wrote {path}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("stage", choices=["harvest", "score", "build", "template",
                                         "sync", "import", "all"])
    parser.add_argument("--work", default="./bg", help="cache directory")
    parser.add_argument("--repo", default=None, help="repo root to write the catalogue into")
    parser.add_argument("--quality", type=int, default=70, help="cwebp quality")
    parser.add_argument("--image", default=None, help="import: the image file to add")
    parser.add_argument("--category", default=None, help="import: catalogue category")
    parser.add_argument("--creator", default=None, help="import: who made it, if credited")
    parser.add_argument("--title", default=None, help="import: a human name for it")
    parser.add_argument("--url", default=None, help="import: where it came from, if anywhere")
    args = parser.parse_args()
    if args.stage == "sync":
        if not args.repo:
            raise SystemExit("sync needs --repo")
        stage_sync(args.repo)
        return
    if args.stage == "import":
        if not (args.repo and args.image and args.category):
            raise SystemExit("import needs --repo, --image and --category")
        stage_import(args.repo, args.image, args.category, args.quality,
                     creator=args.creator, title=args.title, url=args.url)
        return
    os.makedirs(args.work, exist_ok=True)

    pool = stage_harvest(args.work)
    if args.stage == "harvest":
        return
    scored = stage_score(args.work, pool)
    if args.stage == "score":
        return
    if args.stage in ("build", "all"):
        rows = stage_build(args.work, scored, args.quality)
    else:
        rows = json.load(open(f"{args.work}/built.json"))
    if args.stage in ("template", "all"):
        stage_template(args.work, rows, args.repo)


if __name__ == "__main__":
    main()
