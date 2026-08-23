# Motivana bundled fonts

The local `.ttf` assets are static instances derived from the official Google
Fonts variable TrueType sources listed below. They retain the upstream OFL
license text stored beside this file.

| Local assets                              | Upstream family | Official Google Fonts source                         |
| ----------------------------------------- | --------------- | ---------------------------------------------------- |
| `Inter-Regular.ttf`, `Inter-SemiBold.ttf` | Inter           | https://github.com/google/fonts/tree/main/ofl/inter  |
| `Lora-Regular.ttf`, `Lora-SemiBold.ttf`   | Lora            | https://github.com/google/fonts/tree/main/ofl/lora   |
| `Oswald-Medium.ttf`                       | Oswald          | https://github.com/google/fonts/tree/main/ofl/oswald |

Exact downloaded upstream binary sources:

- https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf

## Provenance checksums (2026-08-24)

The shipped files are static TrueType instances (their `fvar` tables are absent),
not direct static files fetched from Google Fonts. SHA-256 identifies both the
three official variable-font source bytes retrieved from the URLs above and the
five bundled output bytes:

| Source / bundled asset | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Inter variable source  | `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031` |
| Lora variable source   | `822a6621ccbe8d97d20ac88c1c41f5615c9c2c202eaa75f272cd452aac6475a7` |
| Oswald variable source | `5b38c246e255a12f5712d640d56bcced0472466fc68983d2d0410ec0457c2817` |
| `Inter-Regular.ttf`    | `d9c444b3a3ff4343a88c71b0680a6f1db367fed0d42dc82b6d2e7af309cf68f8` |
| `Inter-SemiBold.ttf`   | `7c8611badb464679498da97d44779c8734ca5fab6300f5145e7d7a432adf4ff8` |
| `Lora-Regular.ttf`     | `457d45812a7ed871d9ec4c95b2ff996c7c3bb38414e16401795fdf9bbcb770e9` |
| `Lora-SemiBold.ttf`    | `fbeca98cd84b04a5d7699af4ade1919b9f434eae1c8c2900d556c4ca062efcff` |
| `Oswald-Medium.ttf`    | `56d4424e88f5e372e64d2aea82d551428e1d351b57275a1e0a9429920ef82284` |

Task 2 recorded that these outputs were instanced from the official variable
sources, but did not record the instancer command or version. That historical
process cannot be reconstructed from the font binaries, so this document does
not invent one. The checksums make the source and shipped artifacts auditable;
any future re-instancing must record its command and tool version.
