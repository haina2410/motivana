# Motivana bundled fonts

The local `.ttf` assets are static, Vietnamese-subset instances derived from the
official Google Fonts TrueType sources listed below. They retain the upstream
OFL license text stored beside this file.

| Local assets                                                                                                 | Upstream family    | Official Google Fonts source                                    |
| ------------------------------------------------------------------------------------------------------------ | ------------------ | --------------------------------------------------------------- |
| `CormorantGaramond-Light.ttf`, `CormorantGaramond-Regular.ttf`                                               | Cormorant Garamond | https://github.com/google/fonts/tree/main/ofl/cormorantgaramond |
| `BeVietnamPro-Light.ttf`, `BeVietnamPro-Regular.ttf`, `BeVietnamPro-Medium.ttf`, `BeVietnamPro-SemiBold.ttf` | Be Vietnam Pro     | https://github.com/google/fonts/tree/main/ofl/bevietnampro      |
| `DancingScript-Medium.ttf`                                                                                   | Dancing Script     | https://github.com/google/fonts/tree/main/ofl/dancingscript     |
| `Lora-Regular.ttf`, `Lora-SemiBold.ttf`                                                                      | Lora               | https://github.com/google/fonts/tree/main/ofl/lora              |

Exact downloaded upstream binary sources:

- https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Light.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Medium.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-SemiBold.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf

## Instancing and subsetting (2026-08-25)

Tool: `fonttools` 4.55.3, run from the GitHub source tree
(`https://github.com/fonttools/fonttools/archive/refs/tags/4.55.3.tar.gz`,
`PYTHONPATH=<tree>/Lib`) on CPython 3.13.

Cormorant Garamond and Dancing Script ship only as variable fonts upstream, so
each shipped weight is a static instance:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

font = TTFont("CormorantGaramond[wght].ttf")
instancer.instantiateVariableFont(font, {"wght": 300}, inplace=True, updateFontNames=True)
font.save("CormorantGaramond-Light.ttf")   # 400 -> CormorantGaramond-Regular.ttf
```

```python
font = TTFont("DancingScript[wght].ttf")
instancer.instantiateVariableFont(font, {"wght": 500}, inplace=True, updateFontNames=True)
font.save("DancingScript-Medium.ttf")
```

Be Vietnam Pro is fetched as an upstream static file and only subset.

Every shipped file is then cut to `latin + latin-ext + vietnamese`, which is the
whole reason the app can carry four families under a megabyte:

```
python -m fontTools.subset <input>.ttf \
  --unicodes=U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,\
U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,\
U+0100-02AF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF,\
U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,\
U+0308-0309,U+0323,U+0329,U+1EA0-1EF9 \
  --layout-features=<see below> --no-hinting --name-IDs=* --name-legacy --notdef-outline \
  --output-file=<output>.ttf
```

`--layout-features=*` for Be Vietnam Pro and Dancing Script.
`--layout-features=ccmp,kern,liga,mark,mkmk,locl,rlig` for Cormorant Garamond,
whose full feature set drags in the small-caps and swash alternates and triples
the file. `mark` and `mkmk` are the features that place stacked Vietnamese tone
marks, so they are never dropped.

Lora is unchanged from the previous task and keeps its earlier provenance:
instanced from the variable source without a recorded command.

## Provenance checksums (2026-08-25)

The shipped files carry no `fvar` table. SHA-256 identifies both the upstream
source bytes retrieved from the URLs above and the bundled output bytes:

| Source / bundled asset             | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| Cormorant Garamond variable source | `b20b7d9626dd956b2c5e558692ad328b1f19e3275e2782db4fa07670d83f35e0` |
| Dancing Script variable source     | `21808625578fe8d8cd10cb684be546dca077b27cd03a53a2f1ec11dc743c924c` |
| Be Vietnam Pro Light source        | `f0b7143edac3fd99960312706cfa51cbafec28e7afa6d4afbd08a73bb246af13` |
| Be Vietnam Pro Regular source      | `cd1ef6e9d7db28ad5cdb88a65ccbe693870e60d340b791f349d248342b4fe4c3` |
| Be Vietnam Pro Medium source       | `b60832bfa0fcd015158112c64d7e3fdad3b0c6287d1823f85a3103636e845268` |
| Be Vietnam Pro SemiBold source     | `bd8e27eb02720b9d91e59e4f10a90878643219f25ce6a8d9a4f06a8a88d3bb71` |
| `CormorantGaramond-Light.ttf`      | `c683db9779e6abdee31d4fd50ca1a86bdb69064d5a305ecaec40a3b0fbe72727` |
| `CormorantGaramond-Regular.ttf`    | `d6d2ad33d790a56510d3d4651e5056a4ba86dc2f7efba9273b19137eab2f7108` |
| `BeVietnamPro-Light.ttf`           | `7c58c9503db261d273c5bb0ad43212d2a217ce0334b2672659e95d22b736ebc5` |
| `BeVietnamPro-Regular.ttf`         | `d2b1cd097dc82c3f0ceb792f5c5c2473b9b8c1c1132c1776c93852532ccc671c` |
| `BeVietnamPro-Medium.ttf`          | `8f58d3e03eabd8ef6dcc95ed22e727f607df8bee73e88d0d1b8b9965efe679d2` |
| `BeVietnamPro-SemiBold.ttf`        | `e2d0e8491ae81dcc3ce2ac8fde708e92518aad0c22f18a6dfe5bab9a9e09dd39` |
| `DancingScript-Medium.ttf`         | `786865f5fa9583c91109fa1b6978eccef0d7a5a5cfe43f80528b2979c4ac16e3` |
| `Lora-Regular.ttf`                 | `457d45812a7ed871d9ec4c95b2ff996c7c3bb38414e16401795fdf9bbcb770e9` |
| `Lora-SemiBold.ttf`                | `fbeca98cd84b04a5d7699af4ade1919b9f434eae1c8c2900d556c4ca062efcff` |

Inter and Oswald were removed with this redesign: no preset references them and
neither ships a designed Vietnamese diacritic set.
