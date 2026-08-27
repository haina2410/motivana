# Vietnamese quote sources

Vietnamese is the target language. The safest material is also the most
timeless, so work down this ladder and stop as soon as a rung gives you enough.

## Rung 1: folk material (best)

`tục ngữ` (proverbs) and `ca dao` (folk verse) have no author, no date and no
copyright holder. They are the natural fit for a wallpaper: short, self
contained, and already worn smooth by use.

Set `author` to nothing at all, `rights` to `folk-anonymous`, and cite the
collection or the reference page you read it in. Do not invent an author for a
proverb - the internet is full of proverbs wearing a famous name.

## Rung 2: named public-domain authors

Vietnam's IP Law gives an individual work the author's life plus 50 years, so
these are clear:

| Author        | Died | Note                          |
| ------------- | ---- | ----------------------------- |
| Nguyễn Trãi   | 1442 | classical prose and verse     |
| Nguyễn Du     | 1820 | Truyện Kiều                   |
| Nguyễn Bá Học | 1921 | essays and advice to students |
| Phan Bội Châu | 1940 | essays                        |
| Nam Cao       | 1951 | fiction                       |
| Hồ Chí Minh   | 1969 | public domain from 2020       |

Still in copyright, so treat as rung 3: Xuân Diệu (1985), Trịnh Công Sơn
(2001), and every living writer.

## Rung 3: living authors, talks, news, social posts

Quotation with attribution is permitted under the fair-use provisions of
Vietnam's IP Law when the source is named and the meaning is not changed. Use
this rung sparingly, keep the quote short, always set
`rights: "in-copyright"`, and always cite the exact talk, article or post.

News and social posts are the weakest rung twice over: they are usually about
an event, which the timeless test rejects anyway.

## Where to look

| Source              | Good for                                           |
| ------------------- | -------------------------------------------------- |
| `vi.wikisource.org` | full primary texts you can search for the wording  |
| `vi.wikiquote.org`  | leads - use only the entries that carry a citation |
| `thivien.net`       | poetry with the original text and source notes     |
| `nomfoundation.org` | Truyện Kiều, line by line                          |
| Project Gutenberg   | public-domain English translations                 |

Never cite: brainyquote, azquotes, goodreads, "danh ngôn" or "câu nói hay"
aggregator pages, or a Facebook or TikTok screenshot. These are where
misattribution is manufactured. A famous Vietnamese name attached to a
motivational line on one of those pages is wrong more often than right.

## The trap inside the good collections

A 19th-century proverb collection (Huỳnh Tịnh Của, _Tục ngữ, cổ ngữ, gia ngôn_,
1897, is the fullest one on wikisource) holds two different kinds of line mixed
together:

- **Living proverbs** that a Vietnamese reader still says today. These are what
  you want.
- **Hán-Việt maxims** carried over from Chinese, such as `Cố ư trung tất hình ư
ngoại`. The provenance is perfect and the meaning is real, but a reader today
  cannot read it off a wallpaper. Reject them.

Roughly a quarter of a batch drawn from these collections falls in the second
group, so expect to reject on readability more often than on provenance.

Texts printed in the 1920s also hyphenate compounds (`hi-vọng`, `tự-trọng`).
Modernising the spelling changes every word, so reject the candidate rather than
rewrite it.

## Writing the record

- **Diacritics must be exact and NFC normalised.** A stripped or wrong tone mark
  changes the word. Compare your text against the source character by character.
- **Prefer 110 characters or fewer for `vi`.** Vietnamese needs the taller line
  height the presets carry, so a long Vietnamese line shrinks on the wallpaper
  faster than the same length in English. The hard cap stays 160.
- **No `text.en`.** The record holds the Vietnamese only. An English rendering
  of yours would reach the catalogue as a quote, and the next reader would take
  it for the author's own words. A Vietnamese source gives a Vietnamese entry;
  that is the whole point of this page.
- **`sourceLocale` is `vi`** for everything on this page.
