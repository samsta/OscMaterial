"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MAX_DIR = path.join(ROOT, "max");
const PAINTER_FILE = "OscMaterialSlider.js";
const COLOR_REFRESH_FILE = "OscMaterialColorRefresh.js";
const [materialPath, outputPath] = process.argv.slice(2);

if (!materialPath) {
  throw new Error("Usage: node tools/generate-material-device.js <material.fs> [output.amxd]");
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readAmpf(file) {
  const buffer = fs.readFileSync(file);
  let payloadOffset;
  let payloadLength;
  let format;

  if (buffer.subarray(0, 4).toString("ascii") !== "ampf") {
    throw new Error(`${file} is not an AMPF Max for Live device.`);
  }
  if (buffer.subarray(12, 16).toString("ascii") === "ptch") {
    format = "compact";
    payloadOffset = 20;
    payloadLength = buffer.readUInt32LE(16);
  } else if (buffer.subarray(24, 28).toString("ascii") === "ptch") {
    format = "metadata";
    payloadOffset = 32;
    payloadLength = buffer.readUInt32LE(28);
  } else {
    throw new Error(`${file} has an unsupported AMPF chunk layout.`);
  }
  return {
    format,
    device: JSON.parse(
      buffer.subarray(payloadOffset, payloadOffset + payloadLength).toString("utf8").replace(/\0+$/, "")
    )
  };
}

function writeAmpf(file, device, format) {
  const payload = Buffer.from(`${JSON.stringify(device, null, 2)}\n`, "utf8");
  const header = Buffer.alloc(format === "compact" ? 20 : 32);
  header.write("ampf", 0, "ascii");
  header.writeUInt32LE(4, 4);
  if (format === "compact") {
    header.write("aaaa", 8, "ascii");
    header.write("ptch", 12, "ascii");
    header.writeUInt32LE(payload.length, 16);
  } else {
    header.write("aaaameta", 8, "ascii");
    header.writeUInt32LE(4, 16);
    header.writeUInt32LE(1, 20);
    header.write("ptch", 24, "ascii");
    header.writeUInt32LE(payload.length, 28);
  }
  fs.writeFileSync(file, Buffer.concat([header, payload, Buffer.from([0])]));
}

function fileStem(file) {
  return path.basename(file, path.extname(file));
}

function findThumbnail(materialDirectory) {
  for (const filename of ["thumbnail.jpg", "thumbnail.png"]) {
    const candidate = path.join(materialDirectory, filename);

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `No thumbnail found beside the material. Expected ${path.join(materialDirectory, "thumbnail.jpg")} or thumbnail.png.`
  );
}

function safeSegment(value, fallback) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function labelPath(label, fallback) {
  return String(label || fallback)
    .split("/")
    .map((segment, index) => safeSegment(segment, `${fallback}_${index + 1}`))
    .join("/");
}

function colorToHsv(color) {
  const red = Number(color[0]) || 0;
  const green = Number(color[1]) || 0;
  const blue = Number(color[2]) || 0;
  const alpha = color.length > 3 ? Number(color[3]) : 1;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta) {
    if (maximum === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (maximum === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue /= 6;
    if (hue < 0) {
      hue += 1;
    }
  }
  return {
    hue,
    saturation: maximum ? delta / maximum : 0,
    value: maximum,
    alpha: Number.isFinite(alpha) ? alpha : 1
  };
}

function hsvToRgb(hue, saturation, value) {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  const components = [
    [value, t, p],
    [q, value, p],
    [p, value, t],
    [p, q, value],
    [t, p, value],
    [value, p, q]
  ];

  return components[sector % 6];
}

function colorGradientFor(component, defaults) {
  if (component === "saturation") {
    return hsvToRgb(defaults.hue, 1, 1);
  }
  if (component === "value") {
    return hsvToRgb(defaults.hue, defaults.saturation, 1);
  }
  return hsvToRgb(defaults.hue, defaults.saturation, defaults.value);
}

function parseMaterial(file) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const match = /^\s*\/\*([\s\S]*?)\*\//.exec(source);
  let metadata;

  if (!match) {
    throw new Error("The material must begin with a /* ... */ metadata comment.");
  }
  try {
    metadata = JSON.parse(match[1].replace(/,\s*([}\]])/g, "$1"));
  } catch (error) {
    throw new Error(`The leading metadata is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(metadata.INPUTS)) {
    throw new Error("Metadata must contain an INPUTS array.");
  }

  const materialName = metadata.NAME || fileStem(file);
  const materialSegment = safeSegment(materialName, "material");
  const used = new Set();
  const inputs = [];
  const skipped = [];

  for (const raw of metadata.INPUTS) {
    const name = raw.NAME;
    const type = String(raw.TYPE || "").toLowerCase();
    const label = raw.LABEL || name;
    let kind;
    let minimum;
    let maximum;
    let defaultValue;
    let parameterPath;

    if (!name) {
      skipped.push("unnamed input");
      continue;
    }
    if (type === "float" || type === "number") {
      kind = "float";
    } else if (type === "int" || type === "integer") {
      kind = "int";
    } else if (type === "long" && Array.isArray(raw.VALUES) && Array.isArray(raw.LABELS)) {
      kind = "enum";
    } else if (type === "bool" || type === "boolean") {
      kind = "toggle";
    } else if (type === "color" && Array.isArray(raw.DEFAULT)) {
      kind = "color";
    } else if (type === "trigger") {
      kind = "trigger";
    } else {
      skipped.push(`${name} (${type || "unspecified"})`);
      continue;
    }

    parameterPath = labelPath(label, name || `input_${inputs.length + 1}`);
    while (used.has(parameterPath)) {
      parameterPath = `${parameterPath}_${inputs.length + 1}`;
    }
    used.add(parameterPath);
    minimum = Number(raw.MIN);
    maximum = Number(raw.MAX);
    defaultValue = raw.DEFAULT;

    if ((kind === "float" || kind === "int") && (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum)) {
      skipped.push(`${name} (invalid MIN/MAX)`);
      continue;
    }
    if (kind === "float" || kind === "int") {
      defaultValue = Number(defaultValue);
      if (!Number.isFinite(defaultValue)) {
        defaultValue = minimum;
      }
      defaultValue = Math.min(maximum, Math.max(minimum, defaultValue));
    }
    if (kind === "enum") {
      if (raw.VALUES.length !== raw.LABELS.length || !raw.VALUES.length) {
        skipped.push(`${name} (VALUES and LABELS must have matching nonzero lengths)`);
        continue;
      }
      defaultValue = raw.VALUES.indexOf(defaultValue);
      defaultValue = defaultValue < 0 ? 0 : defaultValue;
    }
    if (kind === "toggle") {
      defaultValue = defaultValue ? 1 : 0;
    }

    inputs.push({
      name,
      label,
      kind,
      minimum,
      maximum,
      defaultValue,
      values: raw.VALUES || [],
      labels: raw.LABELS || [],
      colorDefaults: kind === "color" ? colorToHsv(raw.DEFAULT) : null,
      address: `/medias/${materialSegment}/${parameterPath}`
    });
  }
  return { materialName, materialSegment, inputs, skipped };
}

function replaceAddress(value, target) {
  const address = typeof target === "string" ? target : target.address;

  if (typeof value !== "string") {
    return value;
  }
  if (target.kind === "color") {
    value = value.replace(
      /\/medias\/material\/param\/(hue|saturation|value|alpha)/g,
      (_, component) => `${address}/${component}`
    );
    value = value.replace(
      /\/medias\/material\/(hue|saturation|value|alpha)/g,
      (_, component) => `${address}/${component}`
    );
  }
  return value.replace(/\/medias\/material\/(?:param|restart)/g, address);
}

function rewriteSnippet(snippet, prefix, yOffset, input) {
  const patcher = deepCopy(snippet.patcher);
  const idMap = new Map();
  const prependIds = [];

  for (const { box } of patcher.boxes) {
    const oldId = box.id;
    const newId = `${prefix}-${oldId}`;
    const originalVarname = box.varname;
    idMap.set(oldId, newId);
    box.id = newId;
    if (box.patching_rect) {
      box.patching_rect[1] += yOffset;
    }
    if (box.presentation_rect) {
      box.presentation_rect[1] += yOffset;
    }
    box.text = replaceAddress(box.text, input);
    box.texton = replaceAddress(box.texton, input);
    box.varname = replaceAddress(box.varname, input);

    if (box.saved_attribute_attributes && box.saved_attribute_attributes.valueof) {
      const valueof = box.saved_attribute_attributes.valueof;
      const componentMatch = input.kind === "color" &&
        /\/(hue|saturation|value|alpha)$/.exec(originalVarname || "");
      const parameterAddress = componentMatch
        ? `${input.address}/${componentMatch[1]}`
        : input.address;

      valueof.parameter_longname = parameterAddress;
      valueof.parameter_shortname = parameterAddress;
      valueof.parameter_initial = [input.defaultValue];
      valueof.parameter_initial_enable = 1;
      if (input.kind === "float" || input.kind === "color") {
        valueof.parameter_type = 0;
        valueof.parameter_mmin = input.kind === "color" ? 0 : input.minimum;
        valueof.parameter_mmax = input.kind === "color" ? 1 : input.maximum;
        box.annotation = `OSC range: ${valueof.parameter_mmin} to ${valueof.parameter_mmax}`;
        if (componentMatch) {
          valueof.parameter_initial = [input.colorDefaults[componentMatch[1]]];
          box.annotation += `; color-gradient: ${colorGradientFor(
            componentMatch[1],
            input.colorDefaults
          ).map((component) => Number(component.toFixed(6))).join(",")}`;
        }
      } else if (input.kind === "int") {
        valueof.parameter_type = 1;
        valueof.parameter_mmin = input.minimum;
        valueof.parameter_mmax = input.maximum;
        box.annotation = `OSC range: ${valueof.parameter_mmin} to ${valueof.parameter_mmax}`;
      } else if (input.kind === "enum") {
        valueof.parameter_type = 2;
        valueof.parameter_mmin = 0;
        valueof.parameter_mmax = input.labels.length - 1;
        valueof.parameter_enum = input.labels.map(String);
      }
    }
    if (typeof box.text === "string" && box.text.indexOf("prepend ") === 0) {
      prependIds.push(newId);
    }
  }

  for (const { patchline } of patcher.lines) {
    patchline.source[0] = idMap.get(patchline.source[0]);
    patchline.destination[0] = idMap.get(patchline.destination[0]);
  }

  return { boxes: patcher.boxes, lines: patcher.lines, prependIds, height: patcher.openrect[3] };
}

function snippetFor(input, templates) {
  return templates[
    {
      float: "float",
      int: "int",
      enum: "enum",
      toggle: "toggle",
      trigger: "trigger",
      color: "color"
    }[input.kind]
  ];
}

const sourcePath = path.resolve(materialPath);
const material = parseMaterial(sourcePath);
const materialDirectory = path.dirname(sourcePath);
const thumbnailPath = findThumbnail(materialDirectory);
const thumbnailName = path.basename(thumbnailPath);
const destination = path.resolve(
  outputPath || path.join(materialDirectory, `${material.materialSegment}.amxd`)
);
const destinationSource = destination.replace(/\.amxd$/i, ".maxpat");
const destinationPainter = path.join(path.dirname(destination), PAINTER_FILE);
const destinationColorRefresh = path.join(path.dirname(destination), COLOR_REFRESH_FILE);
const destinationThumbnail = path.join(path.dirname(destination), thumbnailName);
const templates = {
  float: readJson(path.join(MAX_DIR, "OscFloat.maxsnip")),
  int: readJson(path.join(MAX_DIR, "OscInt.maxsnip")),
  enum: readJson(path.join(MAX_DIR, "OscEnum.maxsnip")),
  toggle: readJson(path.join(MAX_DIR, "OscToggle.maxsnip")),
  trigger: readJson(path.join(MAX_DIR, "OscTrigger.maxsnip")),
  color: readJson(path.join(MAX_DIR, "OscColor.maxsnip"))
};
const panel = readJson(path.join(MAX_DIR, "OscParamPanel.maxpat"));
const outerTemplate = readAmpf(path.join(MAX_DIR, "OscMaterial.amxd"));
const device = outerTemplate.device;
const panelPatcher = panel.patcher;
const panelOutlet = panelPatcher.boxes.find(({ box }) => box.maxclass === "outlet").box.id;
const resetAddress = `/medias/${material.materialSegment}/restart`;
let yOffset = templates.trigger.patcher.openrect[3];

for (const { box } of panelPatcher.boxes) {
  box.text = replaceAddress(box.text, resetAddress);
  box.texton = replaceAddress(box.texton, resetAddress);
  box.varname = replaceAddress(box.varname, resetAddress);
  if (box.saved_attribute_attributes && box.saved_attribute_attributes.valueof) {
    box.saved_attribute_attributes.valueof.parameter_longname = resetAddress;
    box.saved_attribute_attributes.valueof.parameter_shortname = resetAddress;
  }
}

material.inputs.forEach((input, index) => {
  const fragment = rewriteSnippet(snippetFor(input, templates), `param${index + 1}`, yOffset, input);
  const shade = index % 2 ? 33 / 255 : 25 / 255;

  panelPatcher.boxes.push({
    box: {
      id: `param${index + 1}-background`,
      maxclass: "panel",
      background: 1,
      bgcolor: [shade, shade, shade, 1],
      patching_rect: [0, yOffset, 250, fragment.height],
      presentation: 1,
      presentation_rect: [0, yOffset, 250, fragment.height]
    }
  });

  panelPatcher.boxes.push(...fragment.boxes);
  panelPatcher.lines.push(...fragment.lines);
  for (const prependId of fragment.prependIds) {
    panelPatcher.lines.push({
      patchline: { source: [prependId, 0], destination: [panelOutlet, 0] }
    });
  }
  yOffset += fragment.height;
});

panelPatcher.openrect = [0, 0, 250, yOffset];
panelPatcher.rect[2] = 250;
panelPatcher.rect[3] = yOffset;
panelPatcher.devicewidth = 250;
panelPatcher.description = `OSC parameters for ${material.materialName}`;
panelPatcher.title = `${material.materialName} parameters`;

const outer = device.patcher;
const panelBox = outer.boxes.find(({ box }) => box.maxclass === "bpatcher").box;
const thumbnailBox = outer.boxes.find(({ box }) => box.maxclass === "fpic")?.box;

if (!thumbnailBox) {
  throw new Error("The outer AMXD template must contain an fpic box for the material thumbnail.");
}

thumbnailBox.pic = thumbnailName;
thumbnailBox.autofit = 1;
panelBox.embed = 1;
panelBox.name = "OscParamPanel.maxpat";
panelBox.patcher = panelPatcher;
panelBox.enablehscroll = 0;
panelBox.enablevscroll = 1;
panelBox.lockeddragscroll = 0;
outer.lines = outer.lines.filter(({ patchline }) => !(
  patchline.source[0] === panelBox.id || patchline.destination[0] === panelBox.id
));
outer.lines.push(
  { patchline: { source: [panelBox.id, 0], destination: ["obj-13", 0] } }
);
outer.title = `${material.materialName} OSC`;
outer.description = `OSC controls for ${material.materialName}`;
outer.digest = "Generated MadMapper material OSC controller";
outer.dependency_cache = [];
outer.parameters = {
  "obj-46": ["port", "port", 0],
  "obj-86": ["host", "host", 0],
  parameterbanks: {
    0: {
      index: 0,
      name: material.materialName,
      parameters: []
    }
  },
  parameter_overrides: {},
  inherited_shortname: 1
};
panelPatcher.boxes
  .map(({ box }) => box)
  .filter((box) => box.parameter_enable && box.saved_attribute_attributes?.valueof)
  .forEach((box) => {
    const valueof = box.saved_attribute_attributes.valueof;
    const key = `${panelBox.id}::${box.id}`;

    outer.parameters[key] = [
      valueof.parameter_longname,
      valueof.parameter_shortname,
      0
    ];
    outer.parameters.parameterbanks[0].parameters.push(valueof.parameter_longname);
    outer.parameters.parameter_overrides[key] = {
      parameter_invisible: 0,
      parameter_longname: valueof.parameter_longname,
      parameter_modmode: 0,
      parameter_type: valueof.parameter_type,
      parameter_unitstyle: valueof.parameter_unitstyle || 0
    };
  });

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destinationSource, `${JSON.stringify(device, null, 2)}\n`);
if (path.resolve(destinationPainter) !== path.join(MAX_DIR, PAINTER_FILE)) {
  fs.copyFileSync(path.join(MAX_DIR, PAINTER_FILE), destinationPainter);
}
if (path.resolve(destinationColorRefresh) !== path.join(MAX_DIR, COLOR_REFRESH_FILE)) {
  fs.copyFileSync(path.join(MAX_DIR, COLOR_REFRESH_FILE), destinationColorRefresh);
}
if (path.resolve(destinationThumbnail) !== thumbnailPath) {
  fs.copyFileSync(thumbnailPath, destinationThumbnail);
}
writeAmpf(destination, device, outerTemplate.format);

console.log(`Generated ${path.relative(process.cwd(), destination)} from templates.`);
console.log(`Wrote ${path.relative(process.cwd(), destinationPainter)} for custom slider rendering.`);
console.log(`Wrote ${path.relative(process.cwd(), destinationColorRefresh)} for live color gradient updates.`);
console.log(`Configured ${thumbnailName} as the device thumbnail.`);
console.log(`Embedded ${material.inputs.length} inputs plus reset; skipped ${material.skipped.length}.`);
