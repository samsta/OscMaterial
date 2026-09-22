# OscMaterial

Generate a material-specific Max for Live device from a MadMapper `.fs` file. Every material folder must contain its `.fs` file and a `thumbnail.jpg` or `thumbnail.png`. Each generated device uses the provided `OscMaterial.amxd` outer-device template, displays that thumbnail, and embeds a generated scrollable `OscParamPanel` in its bpatcher.

```sh
npm run generate:material -- /absolute/path/to/material.fs
```

The resulting device is written beside the source material as `<material>.amxd`, alongside its editable `.maxpat` source, `OscMaterialSlider.js` painter, and `OscMaterialColorRefresh.js` helper. Keep the AMXD, JavaScript files, and thumbnail together in the material folder when deploying the device, then drag the `.amxd` onto a Live track. It registers each control with its exact OSC name at device-load time, following the template convention:

```text
/medias/<material-name>/<input-name>
```

This is necessary because Live fixes a device's automatable parameter names when the AMXD is instantiated.

## Generated controls

The generator reads the leading material JSON comment and composes the supplied parameter snippets vertically into `OscParamPanel.maxpat`, using each snippet's `openrect` height without additional padding:

| Metadata type | Snippet |
|---|---|
| `float`, `number` | `OscFloat.maxsnip` |
| `int`, `integer` | `OscInt.maxsnip` |
| `long` with `VALUES` and `LABELS` | `OscEnum.maxsnip` |
| `bool`, `boolean` | `OscToggle.maxsnip` |
| `trigger` | `OscTrigger.maxsnip` |
| `color` | `OscColor.maxsnip` |

Each generated panel retains the supplied reset trigger. A color input generates hue, saturation, value, and alpha float controls beneath its label path, initialized by converting the material's RGBA default to HSVA. Other unsupported input types are skipped and reported by the generator. Enum controls preserve the supplied `OscEnum.maxsnip` behavior and emit its Live menu index.

OSC routes derive from `LABEL`, not shader `NAME`, so `{"LABEL": "Base/Invert", "NAME": "mat_inv"}` sends to `/medias/<material>/Base/Invert`. Label hierarchy is retained; spaces and other unsafe characters within individual path segments are normalized to `_`.

Generated snippets have alternating `#191919` and `#212121` backgrounds to separate adjacent controls.

Float, integer, and color controls remain native `live.slider` objects for Live automation, but use `OscMaterialSlider.js` to render a Max-style horizontal slider. The address appears above the track, while the declared minimum, current value, and maximum are shown beneath it. Bipolar ranges receive a centered zero marker. HSVA color tracks use gradients: hue is a full spectrum, saturation and value follow the current hue, and alpha fades over a checkerboard using the current HSVA color. `OscMaterialColorRefresh.js` refreshes the dependent tracks whenever a color component changes: hue refreshes saturation/value/alpha, saturation refreshes value/alpha, and value refreshes alpha. It does not change parameter values or emit extra OSC messages. The painter preserves the native object’s mouse and parameter behavior.

## OSC transport and packaging

The outer template's host and port controls remain unchanged. Generated panel messages connect directly to the outer template's `udpsend` object, following the supplied template design.

The panel itself is embedded in the generated AMXD (`bpatcher.embed = 1`), so it has no dependency on `OscParamPanel.maxpat` or the snippets after generation. The material thumbnail, `OscMaterialSlider.js`, and `OscMaterialColorRefresh.js` remain external runtime assets required beside the generated AMXD.

## Validation

```sh
npm test
npm run validate:templates
npm run validate:amxd
```

`npm run build:example` regenerates `materials/example-material.amxd` from the bundled material fixture.
