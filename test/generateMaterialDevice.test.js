const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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
    const painter = path.join(outputDirectory, "OscMaterialSlider.js");
    const colorRefreshPath = path.join(outputDirectory, "OscMaterialColorRefresh.js");
    const generatedSource = path.join(outputDirectory, "example.maxpat");
    const thumbnail = path.join(outputDirectory, "thumbnail.jpg");
    const thumbnailBox = device.boxes.map(({ box }) => box).find((box) => box.maxclass === "fpic");
    const parameters = panel.patcher.boxes
      .map(({ box }) => box)
      .filter((box) => box.parameter_enable)
      .map((box) => box.saved_attribute_attributes.valueof);

    assert.equal(container.subarray(0, 4).toString("ascii"), "ampf");
    assert.equal(panel.embed, 1);
    assert.equal(fs.readFileSync(painter, "utf8"), fs.readFileSync("max/OscMaterialSlider.js", "utf8"));
    assert.equal(
      fs.readFileSync(colorRefreshPath, "utf8"),
      fs.readFileSync("max/OscMaterialColorRefresh.js", "utf8")
    );
    assert.equal(fs.existsSync(generatedSource), false);
    assert.deepEqual(fs.readFileSync(thumbnail), fs.readFileSync("materials/thumbnail.jpg"));
    assert.equal(thumbnailBox.pic, "thumbnail.jpg");
    assert.equal(thumbnailBox.autofit, 1);
    assert.deepEqual(panel.presentation_rect, templatePanel.presentation_rect);
    assert.deepEqual(panel.patching_rect, templatePanel.patching_rect);
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Motion_X"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Base/Noise"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Base/Invert"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/Color/Face/hue"));
    assert.ok(parameters.some((parameter) => parameter.parameter_longname === "/medias/example-material/restart"));
    const sliderBoxes = panel.patcher.boxes
      .map(({ box }) => box)
      .filter((box) => box.maxclass === "live.slider");
    assert.ok(sliderBoxes.length > 0);
    assert.ok(sliderBoxes.every((box) => box.jspainterfile === "OscMaterialSlider.js"));
    assert.ok(
      sliderBoxes.some(
        (box) =>
          box.saved_attribute_attributes.valueof.parameter_longname === "/medias/example-material/Motion_X" &&
          box.annotation === "OSC range: -3 to 7"
      )
    );
    const colorRefreshBoxes = panel.patcher.boxes
      .map(({ box }) => box)
      .filter((box) => box.text?.startsWith("js OscMaterialColorRefresh.js /medias/example-material/Color/Face"));
    assert.deepEqual(
      colorRefreshBoxes.map((box) => box.text),
      [
        "js OscMaterialColorRefresh.js /medias/example-material/Color/Face saturation value alpha",
        "js OscMaterialColorRefresh.js /medias/example-material/Color/Face value alpha",
        "js OscMaterialColorRefresh.js /medias/example-material/Color/Face alpha"
      ]
    );
    assert.deepEqual(
      panel.patcher.lines
        .filter(({ patchline }) => colorRefreshBoxes.some((box) => box.id === patchline.destination[0]))
        .map(({ patchline }) => [patchline.source[0], patchline.destination[0]]),
      [
        ["param8-obj-6", "param8-obj-37"],
        ["param8-obj-5", "param8-obj-36"],
        ["param8-obj-3", "param8-obj-35"]
      ]
    );
    assert.ok(
      sliderBoxes.some(
        (box) =>
          box.saved_attribute_attributes.valueof.parameter_longname === "/medias/example-material/Color/Face/hue" &&
          box.annotation.startsWith("OSC range: 0 to 1; color-gradient: ")
      )
    );
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

test("slider painter renders a spectrum behind hue controls", () => {
  const stops = [];
  const values = {
    "/medias/example-material/Color/Face/hue": 0.5,
    "/medias/example-material/Color/Face/saturation": 0.75,
    "/medias/example-material/Color/Face/value": 0.8,
    "/medias/example-material/Color/Face/alpha": 1
  };
  const painter = fs.readFileSync(path.join(__dirname, "../max/OscMaterialSlider.js"), "utf8");
  const context = {
    box: {
      getvalueof: () => 0.5,
      getattr: (name) =>
        ({
          annotation: "OSC range: 0 to 1; color-gradient: 0.1,0.2,0.3",
          varname: "/medias/example-material/Color/Face/hue",
          slidercolor: [0.52, 0.45, 0.45, 1],
          textcolor: [0.95, 0.58, 0.13, 1]
        })[name],
      patcher: {
        getnamed: (name) => ({
          getvalueof: () => values[name]
        })
      }
    },
    mgraphics: {
      size: [250, 41],
      set_source_rgba: () => {},
      set_source: () => {},
      rectangle: () => {},
      fill: () => {},
      stroke: () => {},
      select_font_face: () => {},
      set_font_size: () => {},
      move_to: () => {},
      text_path: () => {},
      text_measure: () => [10, 9],
      pattern_create_linear: () => ({
        add_color_stop_rgba: (...arguments_) => stops.push(arguments_)
      })
    }
  };

  vm.runInNewContext(painter, context);
  context.paint();

  assert.deepEqual(stops, [
    [0, 1, 0, 0, 1],
    [1 / 6, 1, 1, 0, 1],
    [2 / 6, 0, 1, 0, 1],
    [3 / 6, 0, 1, 1, 1],
    [4 / 6, 0, 0, 1, 1],
    [5 / 6, 1, 0, 1, 1],
    [1, 1, 0, 0, 1]
  ]);
});

test("slider painter uses the current hue for saturation gradients", () => {
  const stops = [];
  const values = {
    "/medias/example-material/Color/Face/hue": 0.5,
    "/medias/example-material/Color/Face/saturation": 0.75,
    "/medias/example-material/Color/Face/value": 0.8
  };
  const painter = fs.readFileSync(path.join(__dirname, "../max/OscMaterialSlider.js"), "utf8");
  const context = {
    box: {
      getvalueof: () => 0.75,
      getattr: (name) =>
        ({
          annotation: "OSC range: 0 to 1; color-gradient: 1,0,0",
          varname: "/medias/example-material/Color/Face/saturation",
          slidercolor: [0.52, 0.45, 0.45, 1],
          textcolor: [0.95, 0.58, 0.13, 1]
        })[name],
      patcher: {
        getnamed: (name) => ({ getvalueof: () => values[name] })
      }
    },
    mgraphics: {
      size: [250, 41],
      set_source_rgba: () => {},
      set_source: () => {},
      rectangle: () => {},
      fill: () => {},
      stroke: () => {},
      select_font_face: () => {},
      set_font_size: () => {},
      move_to: () => {},
      text_path: () => {},
      text_measure: () => [10, 9],
      pattern_create_linear: () => ({
        add_color_stop_rgba: (...arguments_) => stops.push(arguments_)
      })
    }
  };

  vm.runInNewContext(painter, context);
  context.paint();

  assert.deepEqual(stops, [
    [0, 0.78, 0.78, 0.78, 1],
    [1, 0, 1, 1, 1]
  ]);
});

test("color refresh helper repaints selected dependent controls without emitting values", () => {
  const messages = [];
  const values = {
    "/medias/example-material/Color/Face/saturation": 0.75,
    "/medias/example-material/Color/Face/value": 0.8,
    "/medias/example-material/Color/Face/alpha": 1
  };
  const refresh = fs.readFileSync(path.join(__dirname, "../max/OscMaterialColorRefresh.js"), "utf8");
  const context = {
    jsarguments: [
      "OscMaterialColorRefresh.js",
      "/medias/example-material/Color/Face",
      "value",
      "alpha"
    ],
    patcher: {
      getnamed: (name) => ({
        getvalueof: () => values[name],
        message: (...arguments_) => messages.push([name, ...arguments_])
      })
    }
  };

  vm.runInNewContext(refresh, context);
  context.msg_float(0.5);

  assert.equal(context.outlets, 0);
  assert.deepEqual(messages, [
    ["/medias/example-material/Color/Face/value", "set", 0.8],
    ["/medias/example-material/Color/Face/alpha", "set", 1]
  ]);
});

test("slider painter reads generated ranges and renders an aligned bipolar scale", () => {
  const rectangles = [];
  const labels = [];
  const painter = fs.readFileSync(path.join(__dirname, "../max/OscMaterialSlider.js"), "utf8");
  const context = {
    box: {
      getvalueof: () => 0,
      getattr: (name) =>
        ({
          annotation: "OSC range: -5 to 5",
          varname: "/medias/example-material/Motion_X",
          slidercolor: [0.52, 0.45, 0.45, 1],
          textcolor: [0.95, 0.58, 0.13, 1]
        })[name]
    },
    mgraphics: {
      size: [250, 41],
      set_source_rgba: () => {},
      rectangle: (...arguments_) => rectangles.push(arguments_),
      fill: () => {},
      stroke: () => {},
      select_font_face: () => {},
      set_font_size: () => {},
      move_to: () => {},
      text_path: (text) => labels.push(text),
      text_measure: (text) => [text.length * 5, 9]
    }
  };

  vm.runInNewContext(painter, context);
  context.paint();

  assert.ok(rectangles.some((rectangle) => rectangle.join(",") === "125,15,1,10"));
  assert.deepEqual(labels, [
    "/medias/example-material/Motion_X",
    "-5",
    "5",
    "0"
  ]);
});
