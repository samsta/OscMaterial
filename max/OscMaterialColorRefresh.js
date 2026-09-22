inlets = 1;
outlets = 0;

var baseAddress = jsarguments[1];
var components = jsarguments.slice(2);

function msg_float() {
  refresh();
}

function msg_int() {
  refresh();
}

function refresh() {
  var index;
  var slider;
  var value;

  for (index = 0; index < components.length; index += 1) {
    slider = this.patcher.getnamed(baseAddress + "/" + components[index]);
    if (!slider) {
      continue;
    }
    value = slider.getvalueof();
    if (value instanceof Array) {
      value = value[0];
    }
    slider.message("set", value);
  }
}
