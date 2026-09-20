const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("generates an embedded template device with typed, named parameters", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "osc-material-"));
  const output = path.join(outputDirectory, "example.amxd");
  const templateContainer = fs.readFileSync(path.join(__dirname, "../max/OscMaterial.amxd"));
  const templatePayloadOffset =
    templateContainer.subarray(12, 16).toString("ascii") === "ptch" ? 20 : 32;
  const templatePayloadLength = templateContainer.readUInt32LE(templatePayloadOffset - 4);
  const template = JSON.parse(
    templateContainer
      .subarray(templatePayloadOffset, templatePayloadOffset + templatePayloadLength)
      .toString("utf8")
      .replace(/\0+$/, "")
  ).patcher;
  const templatePanel = template.boxes
    .map(({ box }) => box)
    .find((box) => box.maxclass === "bpatcher");

  try {
    childProcess.execFileSync(
      process.execPath,
      ["tools/generate-material-device.js", "materials/example-material.fs", output],
      { cwd: path.resolve(__dirname, ".."), stdio: "pipe" }
    );

    const container = fs.readFileSync(output);
    const payloadOffset = container.subarray(12, 16).toString("ascii") === "ptch" ? 20 : 32;
    const payloadLength = container.readUInt32LE(payloadOffset - 4);
    const device = JSON.parse(
      container.subarray(payloadOffset, payloadOffset + payloadLength).toString("utf8").replace(/\0+$/, "")
    ).patcher;
    const panel = device.boxes.map(({ box }) => box).find((box) => box.maxclass === "bpatcher");
    const parameters = panel.patcher.boxes
      .map(({ box }) => box)
      .filter((box) => box.parameter_enable)
      .map((box) => box.saved_attribute_attributes.valueof);

    assert.equal(container.subarray(0, 4).toString("ascii"), "ampf");
    assert.equal(panel.embed, 1);
    assert.deepEqual(panel.presentation_rect, templatePanel.presentation_rect);
    assert.deepEqual(panel.patching_rect, templatePanel.patching_rect);
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Motion_X"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Base/Noise"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Base/Invert"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Color/Face/hue"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/restart"));
    assert.equal(panel.patcher.openrect[3], 1340);
    assert.ok(
      Object.values(device.parameters).some((entry) =>
        Array.isArray(entry) && entry[0] === "/medias/example-material/Base/Noise"
      )
    );
    const enumMenu = panel.patcher.boxes
      .map(({ box }) => box)
      .find((box) =>
        box.maxclass === "live.menu" &&
        box.saved_attribute_attributes?.valueof?.parameter_longname === "/medias/example-material/Base/Noise"
      );
    const enumPrefix = enumMenu.id.replace(/-obj-\d+$/, "");

    assert.equal(
      panel.patcher.boxes
        .map(({ box }) => box)
        .filter((box) => box.id.startsWith(`${enumPrefix}-`) && !box.id.endsWith("-background"))
        .length,
      3
    );
    assert.deepEqual(
      panel.patcher.lines
        .filter(({ patchline }) => patchline.source[0].startsWith(`${enumPrefix}-`))
        .map(({ patchline }) => [patchline.source[0], patchline.destination[0]]),
      [
        [`${enumPrefix}-obj-2`, `${enumPrefix}-obj-4`],
        [`${enumPrefix}-obj-4`, "obj-6"]
      ]
    );
    const backgrounds = panel.patcher.boxes
      .map(({ box }) => box)
      .filter((box) => box.id.endsWith("-background"));
    assert.equal(backgrounds.length, 23);
    assert.deepEqual(backgrounds[0].bgcolor, [25 / 255, 25 / 255, 25 / 255, 1]);
    assert.deepEqual(backgrounds[1].bgcolor, [33 / 255, 33 / 255, 33 / 255, 1]);
    assert.ok(
      device.lines.some(({ patchline }) =>
        patchline.source[0] === "obj-5" && patchline.destination[0] === "obj-13"
      )
    );
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});
