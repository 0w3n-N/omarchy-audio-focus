"use strict"
const test = require("node:test")
const assert = require("node:assert/strict")
const Model = require("../Model.js")

const stream = (app, name) => ({ ready: true, properties: { "application.name": app, "media.name": name } })

test("streamDetail shows a browser tab's page title", () => {
  assert.equal(Model.streamDetail(stream("Zen", "Lecture 4 - YouTube"), "Zen"), "Lecture 4 - YouTube")
})

test("streamDetail hides generic stream names", () => {
  for (const name of ["AudioStream", "Playback", "audio-src", "AudioCallbackDriver", "audio stream #3", "", "   "])
    assert.equal(Model.streamDetail(stream("App", name), "App"), "", JSON.stringify(name))
})

test("streamDetail hides a name that only repeats the app label", () => {
  assert.equal(Model.streamDetail(stream("Spotify", "spotify"), "Spotify"), "")
})

test("streamDetail collapses whitespace and caps the length", () => {
  assert.equal(Model.streamDetail(stream("Zen", "  a\n\tb  "), "Zen"), "a b")
  assert.equal(Model.streamDetail(stream("Zen", "x".repeat(500)), "Zen").length, 200)
})

test("streamDetail passes markup-shaped titles through as text", () => {
  // Page titles come from websites. They must reach the view verbatim; the QML
  // test below makes sure every Text that shows them is PlainText.
  const title = '<img src="https://example.invalid/t.png">'
  assert.equal(Model.streamDetail(stream("Zen", title), "Zen"), title)
})

test("streamDetail tolerates missing nodes and properties", () => {
  assert.equal(Model.streamDetail(null, "Zen"), "")
  assert.equal(Model.streamDetail({ ready: false }, "Zen"), "")
})

test("parsePalette reads hex colours and ignores everything else", () => {
  const pal = Model.parsePalette('# c\naccent = "#FF5FC8"\ncyan="#5ff5f0"\nmode = "dark"\nbad = "#12"\n')
  assert.deepEqual(pal, { accent: "#ff5fc8", cyan: "#5ff5f0" })
})

test("pickArmedColor keeps the accent when it stands out from the bar text", () => {
  const pal = { accent: "#ff5fc8", cyan: "#5ff5f0" }
  assert.equal(Model.pickArmedColor(pal, "#e4dbff", "#ff5fc8", "#0d0820"), "#ff5fc8")
})

test("pickArmedColor moves off the accent when the bar text uses it", () => {
  const pal = { accent: "#ff5fc8", cyan: "#5ff5f0", blue: "#8b9aff" }
  assert.equal(Model.pickArmedColor(pal, "#ff5fc8", "#ff5fc8", "#0d0820"), "#5ff5f0")
})

test("pickArmedColor accepts Qt's #aarrggbb strings", () => {
  assert.equal(Model.pickArmedColor({ cyan: "#5ff5f0" }, "#ffff5fc8", "#ffff5fc8", "#ff0d0820"), "#5ff5f0")
})

test("pickArmedColor falls back to the accent when nothing contrasts", () => {
  assert.equal(Model.pickArmedColor({}, "#ff5fc8", "#ff5fc8", "#0d0820"), "#ff5fc8")
})
