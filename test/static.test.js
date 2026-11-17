"use strict"
// Static checks on the QML and translations. Nothing here runs the shell.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const read = (f) => fs.readFileSync(path.join(root, f), "utf8")

// Every `Text {` / `ScrollGlyph: Text {` block, with its body.
function textBlocks(source) {
  const blocks = []
  const re = /(^|[\s:])Text\s*\{/g
  let m
  while ((m = re.exec(source))) {
    let depth = 0
    let i = source.indexOf("{", m.index)
    const start = i
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++
      else if (source[i] === "}" && --depth === 0) break
    }
    blocks.push(source.slice(start, i + 1))
  }
  return blocks
}

for (const file of ["Panel.qml", "ArmableSlider.qml"]) {
  test(`${file}: every Text is PlainText`, () => {
    // Stream names and tab titles are untrusted (any website sets its own
    // title). AutoText would render markup in them, so no Text may use it.
    for (const block of textBlocks(read(file))) {
      // Only the block's own lines, not those of child items (a MouseArea).
      let depth = 0, own = ""
      for (const ch of block) {
        if (ch === "{") depth++
        else if (ch === "}") depth--
        else if (depth === 1) own += ch
      }
      assert.match(own, /textFormat:\s*Text\.PlainText/, block.slice(0, 160))
    }
  })
}

const catalog = (lang) => JSON.parse(read(`i18n/${lang}.json`))
const languages = fs.readdirSync(path.join(root, "i18n")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5))

test("every translation key the code uses exists in en.json", () => {
  const en = catalog("en")
  const used = new Set()
  for (const file of ["Panel.qml", "Model.js"])
    for (const m of read(file).matchAll(/\btr?\("(audio\.[A-Za-z.]+)"/g)) used.add(m[1])
  assert.ok(used.size >= 10, `found only ${used.size} keys`)
  for (const key of used) assert.ok(key in en, key)
})

test("every catalog is valid JSON with only known keys", () => {
  const keys = Object.keys(catalog("en"))
  assert.ok(languages.length >= 50, `${languages.length} languages`)
  for (const lang of languages) {
    const strings = catalog(lang)
    for (const [key, value] of Object.entries(strings)) {
      assert.ok(keys.includes(key), `${lang}: unknown key ${key}`)
      assert.equal(typeof value, "string", `${lang}: ${key}`)
    }
  }
})
