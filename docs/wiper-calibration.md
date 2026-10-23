# Wiper calibration · lower-edge 180° tandem sweep

The latest user correction supersedes the earlier mid-glass placement: both pivots now sit at the lower windscreen edge. Each wiper retains a true 180° sweep, synchronized direction and phase, 500 mm nominal blade length (1.5625× the earlier 320 mm version), and overlapping swept areas. This is the requested display mechanism, not a claim about factory motion or measured factory dimensions.

The six fixed reference views, original front photograph, and actual Blender master were inspected. Original body and glazing geometry remain intact. The candidate was rendered and visually checked at front 0°/45°/90°/135°/180° and oblique 90° before synchronization to the master.

## Geometry

- glTF pivots: Y=1.575 m; Z=0.21282/-0.30718 m, 24 mm forward of the measured glass along X.
- Pivot spacing: 520 mm, reduced from 560 mm.
- Nominal blade radial span: 80..580 mm. Removing the old negative inner overhang allows both end poses to park along the bottom edge.
- Rotation axis fitted to the actual inclined windshield. Original rubber cross-sections and connected end caps retained.
- 96 glass-conforming morph intervals over 0–180°, with quarter-interval clearance checks. Both wipers use the existing five-second clock and return to their exact parked pose.
- Drawing mode renders the deforming rubber without a stale static outline copy.

## Coverage boundary

The windshield is inclined, has rounded lower corners, and narrows near its top. A 580 mm sweep radius rises approximately 400 mm in world Y from the lower pivots. It reaches the upper viewing region but leaves approximately 100 mm in vertical height below the highest pane edge. A 5 mm front-view grid estimate gives approximately 65.7% swept coverage and 17.45% shared overlap of the projected pane. These are approximate projected areas, not surface-area or cleaning-efficiency measurements. The two semicircular swept regions overlap centrally. This is not full-pane coverage: a rigid fixed-root 180° pair with 500 mm blades cannot also guarantee every corner is wiped. Increasing radius or reducing spacing further would require rechecking glass-edge escape and end-pose blade/arm collisions. Do not describe this as 100% clean coverage.

## Validation

The regression samples 193 phases and every one of the 432 vertices per assembly. It verifies fixed roots, end-cap closure, blade length, actual windscreen intersection, glass clearance, own pivot clearance, opposite arm/blade separation, absence of projected X crossings, and nine center witnesses swept by both blades at different times.

Candidate and production asset SHA-256: `9559fb30548a3ab464fbb628d91f4e3ed39510eadf5a2ebefde8610f2aecd2aa`.

Measured results: 1.600 mm minimum X clearance to glazing; 20.150 mm minimum simultaneous blade centerline distance; 2.085 mm maximum distance to the shared coverage witnesses. The 33.011 mm maximum assembly clearance includes the raised support arms. These are model-space measurements, not manufacturing tolerances.

Rebuild from the unmodified baseline GLB, never an already calibrated asset:

```sh
node tools/calibrate-web-wipers.mjs ../rv_model/web_studio_asset/mxgarage-rv.glb public/model/mxgarage-rv.glb
node --experimental-strip-types --test tests/wiper-calibration.test.ts
```

For a candidate, pass an output GLB path in an existing work directory. Metadata and the calibration report are written alongside it. Set `WIPER_ASSET_DIR` to test that directory. The original baseline remains unchanged.

Model and motion requests share `lib/vehicle-assets.ts`; bump its revision when publishing both files. The loader rejects mismatched morph counts, and development asset changes reload the preview. Final measurements and output hash are in `public/model/wiper_calibration.json`. Actual Blender renders, previous master backup, synchronization scripts and preservation report are retained in `work/wiper-lower/`.

Browser interaction verification for this lower-edge revision is pending because the Mac was locked. Blender renders and automated geometry checks have been inspected; they do not replace that browser check.
