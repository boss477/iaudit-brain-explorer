# iAudit — Brain age, in perspective

A static brain-age case explorer, recreated from the supplied Claude artifact with the user's textured GLB brain model. No server, API key, live inference, or build step is required.

## Contents

- 26 original cases: 9 IXI, 8 eNKI and 9 SALD, with ages, sex, site and selection notes.
- 174 full-precision recorded predictions across nine model variants, and 130 BrainAgeNeXt internal model outputs.
- 234 original MRI images: seven axial slices and one coronal and sagittal image for each case.
- Interactive textured 3D GLB reference: orbit, zoom, camera presets and optional automatic rotation.
- Age guessing mode, case filters/search, deep links, cohort summaries and CSV/JSON downloads.
- Locally bundled model-viewer and Geist fonts. No runtime CDN dependency for ordinary rendering.

The 3D model is a shared anatomical reference supplied in brain.zip. It is not reconstructed from individual MRI cases, does not represent an age-specific anatomy, and is not an inference input. Selecting a case changes the recorded predictions and MRI slices, not the GLB anatomy. The model's third-party provenance/license was not included in the ZIP; ownership and reuse terms remain with the original asset owner.

## Preview

Serve this folder with any static HTTP server; fetching the JSON requires HTTP rather than opening index.html as a file. For example, from this directory run `npx --yes http-server . -p 4173` and visit http://localhost:4173.

Run `node scripts/validate.mjs` to verify data counts, every MRI file and the GLB container. All asset paths are relative so GitHub Pages project subpaths work.

## GitHub Pages

The included `.github/workflows/pages.yml` validates and publishes the static files on every push to main. Repository Settings → Pages → Source must be GitHub Actions. No compilation or secrets are needed.

## Data provenance

Source: https://claude.ai/artifact/MdJFiN3BfpLeb6gBh82115#case-SALD_031740

Recovered 2026-10-29 from the supplied artifact and updated to the newer research repository dataset at https://github.com/sudarsan2507-hue/iAudit/tree/main/website. Unlike the earlier display-only extraction, `data/cases.json` preserves source prediction precision and internal model outputs. MRI PNGs were copied from the repository without resampling. data/metrics.json preserves additional full study metrics. Model errors shown in the interface and CSV are calculated from the full-precision source values, then rounded for display.

The demo includes selected cases per age decade and each model's largest miss. The full 799-scan CSV is included in data/all_predictions.csv; original MRI volumes are not included. BrainAgeNeXt training included IXI and eNKI; SALD is held out. Cohort MAE and bootstrap confidence intervals come from the recorded source, not from this selected subset.

## Design and bundled software

Taste Skill v2's Achromatic ledger direction (seed 1812289573): neutral chrome, Geist typography, clinical blue-grey ground and a blue prediction mark. Signature element: the textured brain paired with an age-reference plot and original case MRI. A case rail replaces unrelated navigation destinations.

- Taste Skill: https://www.tasteskill.dev/ and https://github.com/Leonxlnx/taste-skill (MIT).
- model-viewer 4.4.0: https://modelviewer.dev/ (Apache-2.0; see vendor/model-viewer-LICENSE.txt).
- Geist font via @fontsource/geist 5.3.0 (SIL OFL; see vendor/geist-LICENSE.txt).
