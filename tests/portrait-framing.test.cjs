const { test } = require("node:test");
const assert = require("node:assert/strict");
const { framing } = require("../portrait-framing.js");
test("missing or malformed face data uses fallback", () => {
  assert.equal(framing(600, 900, 360, 310, []), null);
  assert.equal(framing(600, 900, 0, 310, [[0.4, 0.2, 0.1, 0.1]]), null);
  assert.equal(framing(600, 900, 360, 310, [[NaN, 0.2, 0.1, 0.1]]), null);
});
test("head stays visible for desktop and mobile portrait crops", () => {
  const face = [0.456, 0.1665, 0.149, 0.131];
  for (const [fw, fh] of [
    [360, 310],
    [259, 333],
    [210, 165],
    [148, 181],
  ]) {
    const result = framing(600, 900, fw, fh, [face]);
    assert.equal(result.fit, "cover");
    const [px, py] = result.position.split(" ").map(parseFloat);
    const scale = Math.max(fw / 600, fh / 900);
    const x = ((fw - 600 * scale) * px) / 100;
    const y = ((fh - 900 * scale) * py) / 100;
    assert.ok(face[0] * 600 * scale + x >= 0);
    assert.ok((face[0] + face[2]) * 600 * scale + x <= fw);
    assert.ok((face[1] - 0.65 * face[3]) * 900 * scale + y >= 0);
    assert.ok((face[1] + face[3]) * 900 * scale + y <= fh);
  }
});
test("widely separated faces use contain instead of cutting someone out", () => {
  assert.equal(
    framing(600, 900, 360, 200, [
      [0.1, 0.1, 0.2, 0.2],
      [0.7, 0.7, 0.2, 0.2],
    ]).fit,
    "contain",
  );
});
