"""Execute the renderer boot module and real base-layer switching code."""
import json
import subprocess
from pathlib import Path

import pytest

STATIC = Path(__file__).resolve().parents[1] / "backend/static"


@pytest.mark.parametrize("failure", ["none", "renderer", "bridge"])
def test_esm_boot_orders_namespace_bridge_and_app(failure):
  script = r"""
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const events = [], scripts = [];
const context = vm.createContext({URL, console, window: {}, document: {
  createElement(tag) {
    if (tag === 'canvas') return {getContext: () => null};
    return {};
  },
  body: {appendChild(script) {events.push('app'); scripts.push(script);}}
}});
const failure = process.argv[1];
const module = new vm.SourceTextModule(fs.readFileSync(process.argv[2], 'utf8'), {
  context,
  initializeImportMeta(meta) {meta.url = 'https://example.test/sub/static/map-renderer.mjs?v=1.9.8';},
  async importModuleDynamically(specifier) {
    const bridge = specifier.includes('leaflet-maplibre');
    const name = bridge ? 'bridge' : 'renderer';
    events.push(name);
    if (failure === name) throw new Error('asset unavailable');
    if (bridge) assert.equal(typeof context.window.maplibregl.Map, 'function');
    const exports = bridge ? [] : ['Map'];
    const dep = new vm.SyntheticModule(exports, function() {
      if (!bridge) this.setExport('Map', function Map() {});
    }, {context});
    await dep.link(() => {}); await dep.evaluate(); return dep;
  }
});
(async () => {
  await module.link(() => {}); await module.evaluate();
  assert.deepEqual(events, failure === 'renderer' ? ['renderer', 'app'] : ['renderer', 'bridge', 'app']);
  assert.equal(scripts.length, 1);
  assert.equal(String(scripts[0].src), 'https://example.test/sub/static/app.js?v=1.9.8');
  if (failure === 'none') {
    assert.equal(typeof context.window.maplibregl.Map, 'function');
    assert.equal(context.window.maplibregl.supported(), false);
  } else assert.equal(context.window.maplibregl, null);
})().catch(error => {console.error(error); process.exitCode = 1;});
"""
  result = subprocess.run([
    "node", "--experimental-vm-modules", "-e", script, failure,
    str(STATIC / "map-renderer.mjs"),
  ], capture_output=True, text=True)
  assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("failure", ["unavailable", "add", "context"])
def test_vector_failure_falls_back_to_plain_background(failure):
  """No raster tile providers exist: when the OpenFreeMap vector layer cannot
  be shown the map keeps the requested theme and shows a plain background."""
  source = (STATIC / "app.js").read_text()
  start = source.index("function setBaseLayer(")
  end = source.index("\nif (mapToggle) {", start)
  script = r"""
const assert = require('node:assert/strict');
const events = {};
const makeLayer = (name) => ({
  name,
  getMaplibreMap: () => ({getCanvas: () => ({
    addEventListener(evt, callback) {events[evt] = callback;}
  })})
});
const lightLayer = makeLayer('light');
const baseLayers = {light: lightLayer, dark: FAILURE === 'unavailable' ? null : makeLayer('dark')};
const validLayers = new Set(['dark', 'light']);
const layers = new Set([lightLayer]);
const map = {
  hasLayer(layer) {assert.ok(layer); return layers.has(layer);},
  removeLayer(layer) {layers.delete(layer);},
  addLayer(layer) {
    assert.ok(layer); layers.add(layer);
    if (FAILURE === 'add' && layer === baseLayers.dark) throw new Error('WebGL unavailable');
  }
};
let baseLayer = 'light', stored = '';
const classes = {};
const document = {body: {classList: {toggle(name, value) {classes[name] = value;}}}};
const localStorage = {setItem(key, value) {stored = value;}};
const mapToggle = {};
let warnings = 0;
const reportError = () => { warnings += 1; };
let plainBasemapWarned = false;
FUNCTION
setBaseLayer('dark');
if (FAILURE === 'context') {
  assert.equal(typeof events.webglcontextlost, 'function');
  assert.equal(classes['plain-map'], false);
  events.webglcontextlost();
}
assert.equal(baseLayer, 'dark');
assert.equal(stored, 'dark');
assert.equal(classes['dark-map'], true);
assert.equal(classes['plain-map'], true);
assert.equal(layers.size, 0);
assert.equal(baseLayers.dark, null);
assert.equal(warnings, 1);
assert.equal(mapToggle.textContent, 'Light map');
// Invalid names fall back to dark.
setBaseLayer('satellite');
assert.equal(baseLayer, 'dark');
""".replace("FAILURE", json.dumps(failure)).replace(
    "FUNCTION", source[start:end])
  result = subprocess.run(["node", "-e", script],
                          capture_output=True, text=True)
  assert result.returncode == 0, result.stdout + result.stderr
