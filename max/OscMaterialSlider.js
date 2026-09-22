/*
 * Custom paint routine for the automatable live.slider controls.
 * Native live.slider mouse and parameter handling remains unchanged.
 */

function parameterValue() {
  var value = box.getvalueof();

  if (value instanceof Array) {
    value = value[0];
  }
  value = Number(value);
  return isFinite(value) ? value : 0;
}

function parameterName() {
  var name = box.getattr("varname");

  if (name instanceof Array) {
    name = name[0];
  }
  return typeof name === "string" ? name : "";
}

function color(name, fallback) {
  var value = box.getattr(name);

  return value instanceof Array && value.length === 4 ? value : fallback;
}

function parameterRange() {
  var annotation = box.getattr("annotation");
  var match;
  var minimum;
  var maximum;

  if (annotation instanceof Array) {
    annotation = annotation[0];
  }
  match = /^OSC range:\s*(\S+)\s+to\s+(\S+)$/.exec(annotation || "");
  minimum = match ? Number(match[1]) : 0;
  maximum = match ? Number(match[2]) : 1;

  if (!isFinite(minimum) || !isFinite(maximum) || maximum <= minimum) {
    return { minimum: 0, maximum: 1 };
  }
  return { minimum: minimum, maximum: maximum };
}

function colorGradient() {
  var annotation = box.getattr("annotation");
  var match;

  if (annotation instanceof Array) {
    annotation = annotation[0];
  }
  match = /color-gradient:\s*([0-9.]+),([0-9.]+),([0-9.]+)/.exec(annotation || "");
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function colorComponent(name) {
  var match = /\/(hue|saturation|value|alpha)$/.exec(name);

  return match ? match[1] : "";
}

function hsvToRgb(hue, saturation, value) {
  var sector = Math.floor(hue * 6);
  var fraction = hue * 6 - sector;
  var p = value * (1 - saturation);
  var q = value * (1 - fraction * saturation);
  var t = value * (1 - (1 - fraction) * saturation);
  var components = [
    [value, t, p],
    [q, value, p],
    [p, value, t],
    [p, q, value],
    [t, p, value],
    [value, p, q]
  ];

  return components[sector % 6];
}

function colorBase(name) {
  return name.replace(/\/(hue|saturation|value|alpha)$/, "");
}

function namedValue(name) {
  var sibling;
  var value;

  try {
    if (!box.patcher) {
      return null;
    }
    sibling = box.patcher.getnamed(name);
    if (!sibling) {
      return null;
    }
    value = sibling.getvalueof();
    if (value instanceof Array) {
      value = value[0];
    }
    value = Number(value);
    return isFinite(value) ? value : null;
  } catch (error) {
    return null;
  }
}

function liveGradientColor(name, component, fallback) {
  var base = colorBase(name);
  var hue = namedValue(base + "/hue");
  var saturation = namedValue(base + "/saturation");
  var value = namedValue(base + "/value");

  if (hue === null || saturation === null || value === null) {
    return fallback;
  }
  if (component === "saturation") {
    return hsvToRgb(hue, 1, 1);
  }
  if (component === "value") {
    return hsvToRgb(hue, saturation, 1);
  }
  return hsvToRgb(hue, saturation, value);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatValue(value) {
  var rounded = Math.round(value * 1000) / 1000;

  return String(rounded);
}

function createGradient(x1, y1, x2, y2, stops) {
  var gradient = mgraphics.pattern_create_linear(x1, y1, x2, y2);

  for (var index = 0; index < stops.length; index += 1) {
    gradient.add_color_stop_rgba.apply(gradient, stops[index]);
  }
  return gradient;
}

function drawCheckerboard(x, y, width, height) {
  var size = 4;
  var row;
  var column;

  for (row = 0; row < height; row += size) {
    for (column = 0; column < width; column += size) {
      mgraphics.set_source_rgba((row / size + column / size) % 2
        ? [0.2, 0.2, 0.2, 1]
        : [0.34, 0.34, 0.34, 1]);
      mgraphics.rectangle(x + column, y + row, size, size);
      mgraphics.fill();
    }
  }
}

function drawColorTrack(component, gradientColor, x, y, width, height) {
  var stops;
  var gradient;

  if (component === "alpha") {
    drawCheckerboard(x, y, width, height);
  }

  if (component === "hue") {
    stops = [
      [0, 1, 0, 0, 1],
      [1 / 6, 1, 1, 0, 1],
      [2 / 6, 0, 1, 0, 1],
      [3 / 6, 0, 1, 1, 1],
      [4 / 6, 0, 0, 1, 1],
      [5 / 6, 1, 0, 1, 1],
      [1, 1, 0, 0, 1]
    ];
  } else if (component === "saturation") {
    stops = [[0, 0.78, 0.78, 0.78, 1], [1, gradientColor[0], gradientColor[1], gradientColor[2], 1]];
  } else if (component === "value") {
    stops = [[0, 0, 0, 0, 1], [1, gradientColor[0], gradientColor[1], gradientColor[2], 1]];
  } else {
    stops = [[0, gradientColor[0], gradientColor[1], gradientColor[2], 0], [1, gradientColor[0], gradientColor[1], gradientColor[2], 1]];
  }

  gradient = createGradient(x, y, x + width, y, stops);
  mgraphics.set_source(gradient);
  mgraphics.rectangle(x, y, width, height);
  mgraphics.fill();
}

function paint() {
  var viewsize = mgraphics.size;
  var width = viewsize[0];
  var height = viewsize[1];
  var rangeInfo = parameterRange();
  var minimum = rangeInfo.minimum;
  var maximum = rangeInfo.maximum;
  var value = parameterValue();
  var name = parameterName();
  var component = colorComponent(name);
  var gradientColor = colorGradient();
  var inset = 8;
  var labelY = 10;
  var trackY = 17;
  var trackHeight = 6;
  var scaleY = height - 2;
  var trackWidth = Math.max(1, width - inset * 2);
  var range = maximum - minimum;
  var position;
  var anchor;
  var fillStart;
  var fillEnd;
  var activeColor = color("slidercolor", [0.52, 0.45, 0.45, 1]);
  var textColor = color("textcolor", [0.95, 0.58, 0.13, 1]);
  var handleColor = color("trioncolor", [0.52, 0.45, 0.45, 1]);
  var handleOutlineColor = color("tribordercolor", [0.3, 0.3, 0.3, 1]);
  var mutedTextColor = [0.54, 0.54, 0.54, 1];
  var minimumText = formatValue(minimum);
  var maximumText = formatValue(maximum);
  var valueText = formatValue(value);
  var textWidth;

  if (component && gradientColor) {
    gradientColor = liveGradientColor(name, component, gradientColor);
  }

  value = clamp(value, minimum, maximum);
  valueText = formatValue(value);
  position = inset + ((value - minimum) / range) * trackWidth;
  anchor = minimum < 0 && maximum > 0
    ? inset + ((0 - minimum) / range) * trackWidth
    : inset;
  fillStart = Math.min(anchor, position);
  fillEnd = Math.max(anchor, position);

  if (component && gradientColor) {
    drawColorTrack(component, gradientColor, inset, trackY, trackWidth, trackHeight);
  } else {
    mgraphics.set_source_rgba([0.07, 0.07, 0.07, 0.9]);
    mgraphics.rectangle(inset, trackY, trackWidth, trackHeight);
    mgraphics.fill();
  }

  if (minimum < 0 && maximum > 0) {
    mgraphics.set_source_rgba([0.5, 0.5, 0.5, 0.8]);
    mgraphics.rectangle(anchor, trackY - 2, 1, trackHeight + 4);
    mgraphics.fill();
  }

  if (!component || !gradientColor) {
    mgraphics.set_source_rgba(activeColor);
    mgraphics.rectangle(fillStart, trackY, Math.max(1, fillEnd - fillStart), trackHeight);
    mgraphics.fill();
  }

  mgraphics.set_source_rgba(handleColor);
  mgraphics.rectangle(position - 1, trackY - 4, 3, trackHeight + 8);
  mgraphics.fill();
  mgraphics.set_source_rgba(handleOutlineColor);
  mgraphics.rectangle(position - 1, trackY - 4, 3, trackHeight + 8);
  mgraphics.stroke();

  mgraphics.select_font_face("Arial");
  mgraphics.set_font_size(10);
  mgraphics.set_source_rgba(textColor);
  mgraphics.move_to(inset, labelY);
  mgraphics.text_path(name);
  mgraphics.fill();

  mgraphics.set_font_size(9);
  mgraphics.set_source_rgba(mutedTextColor);
  mgraphics.move_to(inset, scaleY);
  mgraphics.text_path(minimumText);
  mgraphics.fill();

  textWidth = mgraphics.text_measure(maximumText)[0];
  mgraphics.move_to(width - inset - textWidth, scaleY);
  mgraphics.text_path(maximumText);
  mgraphics.fill();

  textWidth = mgraphics.text_measure(valueText)[0];
  mgraphics.set_source_rgba(textColor);
  mgraphics.move_to((width - textWidth) / 2, scaleY);
  mgraphics.text_path(valueText);
  mgraphics.fill();
}
