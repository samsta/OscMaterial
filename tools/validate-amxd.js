"use strict";

const fs = require("node:fs");

const file = process.argv[2];

if (!file) {
  throw new Error("Usage: node tools/validate-amxd.js <device.amxd>");
}

const buffer = fs.readFileSync(file);
let payloadOffset;
let payloadLength;

if (buffer.subarray(0, 4).toString("ascii") !== "ampf") {
  throw new Error(`${file} is not a valid AMPF container.`);
}
if (buffer.subarray(12, 16).toString("ascii") === "ptch") {
  payloadOffset = 20;
  payloadLength = buffer.readUInt32LE(16);
} else if (
  ["aaaameta", "mmmmmeta"].includes(buffer.subarray(8, 16).toString("ascii")) &&
  buffer.subarray(24, 28).toString("ascii") === "ptch"
) {
  payloadOffset = 32;
  payloadLength = buffer.readUInt32LE(28);
} else {
  throw new Error(`${file} has an unsupported AMPF chunk layout.`);
}
if (payloadLength > buffer.length - payloadOffset) {
  throw new Error(`${file} has an invalid AMPF payload length.`);
}

const device = JSON.parse(
  buffer.subarray(payloadOffset, payloadOffset + payloadLength).toString("utf8").replace(/\0+$/, "")
);

if (!device.patcher.project?.amxdtype) {
  throw new Error(`${file} has no Max for Live device type.`);
}

console.log(`${file} is a valid Max for Live AMXD.`);
