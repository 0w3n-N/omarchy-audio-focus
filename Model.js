function isPlaybackStream(node) {
  if (!node || !node.isStream) return false
  if (node.isSink === true) return true

  var mediaClass = String(node.type || "")
  return mediaClass.indexOf("Stream/Output/Audio") !== -1
    || mediaClass.indexOf("AudioOutStream") !== -1
    || mediaClass.indexOf("Output") !== -1
}

function isAudioSource(node) {
  if (!node) return false
  if (node.audio) return true

  var mediaClass = String(node.type || "")
  return mediaClass.indexOf("Audio/Source") !== -1
    || mediaClass.indexOf("AudioSource") !== -1
    || mediaClass.indexOf("Source") !== -1
}

// Project a node list to the primitive rows a Repeater model can hold. A row
// holding the PwNode itself is a QObject that Qt dereferences without a null
// check while it builds the delegate, and PipeWire deletes nodes outright, so a
// graph teardown segfaults the shell. Primitives cannot dangle, which is what
// closes that race -- not the check below, since the node usually dies after the
// snapshot is taken. That is also why filtering the list here never worked.
//
// The name rides along because PipeWire reuses object ids: without it a row
// could resolve to whatever inherited its id. PwNode.name is CONSTANT, so it
// identifies the node it was taken from for as long as that node lives.
function nodeRow(node) {
  if (!node) return null
  var id = node.id
  if (id === undefined || id === null) return null
  return { id: id, name: String(node.name || "") }
}

function rowSnapshot(list) {
  var values = list && list.length ? list : []
  var rows = []
  for (var i = 0; i < values.length; i++) {
    var row = nodeRow(values[i])
    if (row) rows.push(row)
  }
  return rows
}

// tr is an optional translate(key, english) from the QML side (I18n.t);
// without it the English text stands, which is what the Node tests assert.
function outputVolumeName(volume, muted, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  if (muted) return t("audio.level.muted", "Muted")
  var p = Math.round(volume * 100)
  if (p === 0) return t("audio.level.silenced", "Silenced")
  if (p >= 100) return t("audio.level.concertHall", "Concert hall")
  if (p >= 85) return t("audio.level.partyMode", "Party mode")
  if (p >= 70) return t("audio.level.crankedUp", "Cranked up")
  if (p >= 50) return t("audio.level.steadyGroove", "Steady groove")
  if (p >= 30) return t("audio.level.easyListening", "Easy listening")
  if (p >= 15) return t("audio.level.murmur", "Murmur")
  return t("audio.level.whisper", "Whisper")
}

function parseSinkAvailability(raw) {
  var next = {}
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    var parts = line.split("\t")
    if (parts.length >= 2) next[parts[0]] = parts[1] !== "0"
  }
  return next
}

function friendlyDeviceLabel(text) {
  var label = String(text || "").trim()
  label = label.replace(/^sof-soundwire\s+/i, "")
  label = label.replace(/^built-?in audio\s+/i, "")
  label = label.replace(/\s+Output$/i, "")
  label = label.replace(/\s+Input$/i, "")
  label = label.replace(/\bMicrophones\b/g, "Microphone")
  return label
}

function nodeProps(node) {
  return node && node.ready && node.properties ? node.properties : {}
}

// tr as in outputVolumeName; only the fallback for a nameless device is UI copy.
function nodeLabel(node, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  if (!node) return t("audio.unknownDevice", "Unknown")
  var p = nodeProps(node)
  var nickname = friendlyDeviceLabel(node.nickname || node.nick || p["node.nick"] || p["device.profile.description"] || "")
  if (nickname) return nickname
  return friendlyDeviceLabel(node.description || p["node.description"] || node.name || t("audio.unknownDevice", "Unknown"))
}

function isHeadphones(node) {
  if (!node) return false
  var p = nodeProps(node)
  var blob = String([
    node.name, node.description, node.nickname,
    p["device.icon-name"] || "",
    p["device.product.name"] || "",
    p["node.description"] || "",
    p["node.nick"] || ""
  ].join(" ")).toLowerCase()
  return blob.indexOf("headphone") !== -1
    || blob.indexOf("headset") !== -1
    || blob.indexOf("earbud") !== -1
    || blob.indexOf("earphone") !== -1
    || blob.indexOf("airpod") !== -1
}

function sinkGlyph(node) {
  if (!node) return "󰓃"
  if (isHeadphones(node)) return "󰋋"
  var p = nodeProps(node)
  var blob = String([
    node.name, node.description, node.nickname,
    p["device.icon-name"] || "",
    p["device.product.name"] || ""
  ].join(" ")).toLowerCase()
  if (blob.indexOf("bluetooth") !== -1) return "󰂯"
  if (blob.indexOf("hdmi") !== -1 || blob.indexOf("display") !== -1) return "󰍹"
  return "󰓃"
}

function sourceGlyph(node) {
  if (!node) return "󰍬"
  var p = nodeProps(node)
  var blob = String([
    node.name, node.description, node.nickname,
    p["device.icon-name"] || ""
  ].join(" ")).toLowerCase()
  if (blob.indexOf("headset") !== -1) return "󰋋"
  if (blob.indexOf("bluetooth") !== -1) return "󰂯"
  if (blob.indexOf("webcam") !== -1 || blob.indexOf("camera") !== -1) return "󰄀"
  return "󰍬"
}

function friendlyStreamLabel(label) {
  label = String(label || "").trim()
  if (!label) return ""

  var known = {
    "spotify": "Spotify"
  }
  var normalized = label.toLowerCase()
  return known[normalized] || label
}

function streamLabelKey(label) {
  return String(label || "").trim().toLowerCase()
}

function streamLabelIsGeneric(label) {
  return streamLabelKey(label) === "audio-src"
}

function rawStreamLabel(node) {
  if (!node) return ""
  var p = nodeProps(node)
  return p["application.name"]
    || node.description
    || p["media.name"]
    || p["node.name"]
    || node.name
}

function mprisPlayerLabel(player) {
  if (!player) return ""
  return friendlyStreamLabel(player.identity || player.desktopEntry || "")
}

function mprisPlayerIsProxy(player) {
  var dbusName = String(player && player.dbusName || "").toLowerCase()
  var desktopEntry = String(player && player.desktopEntry || "").toLowerCase()
  return dbusName.indexOf("playerctld") !== -1 || desktopEntry === "playerctld"
}

function streamRepresentsMprisPlayer(streamLabel, playerLabel) {
  var streamKey = streamLabelKey(friendlyStreamLabel(streamLabel))
  var playerKey = streamLabelKey(playerLabel)
  if (!streamKey || !playerKey) return false
  return streamKey === playerKey
    || streamKey.indexOf(playerKey) !== -1
    || playerKey.indexOf(streamKey) !== -1
}

function mprisLabelsFor(players, predicate) {
  var values = Array.isArray(players) ? players : []
  var playingCandidates = []
  var candidates = []
  var playingProxyCandidates = []
  var proxyCandidates = []

  for (var i = 0; i < values.length; i++) {
    var player = values[i]
    if (!player) continue
    if (!player.isPlaying && !player.canPlay) continue

    var playerLabel = mprisPlayerLabel(player)
    if (!playerLabel || !predicate(playerLabel)) continue

    if (mprisPlayerIsProxy(player)) {
      if (player.isPlaying) playingProxyCandidates.push(playerLabel)
      proxyCandidates.push(playerLabel)
    } else {
      if (player.isPlaying) playingCandidates.push(playerLabel)
      candidates.push(playerLabel)
    }
  }

  if (playingCandidates.length === 1) return playingCandidates[0]
  if (playingCandidates.length === 0 && playingProxyCandidates.length === 1) return playingProxyCandidates[0]
  if (candidates.length === 1) return candidates[0]
  if (candidates.length === 0 && proxyCandidates.length === 1) return proxyCandidates[0]
  return ""
}

function matchingMprisStreamLabel(label, players) {
  if (streamLabelIsGeneric(label)) return ""
  return mprisLabelsFor(players, function(playerLabel) {
    return streamRepresentsMprisPlayer(label, playerLabel)
  })
}

function unmatchedMprisStreamLabel(label, players, streams) {
  if (!streamLabelIsGeneric(label)) return ""

  return mprisLabelsFor(players, function(playerLabel) {
    var values = Array.isArray(streams) ? streams : []
    for (var i = 0; i < values.length; i++) {
      var stream = values[i]
      var streamLabel = rawStreamLabel(stream)
      if (!streamLabelIsGeneric(streamLabel) && streamRepresentsMprisPlayer(streamLabel, playerLabel))
        return false
    }
    return true
  })
}

// Matching passes no tr, so a nameless stream compares as English everywhere.
function streamLabel(node, players, streams, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  if (!node) return t("audio.stream", "Stream")
  var label = rawStreamLabel(node)
  return friendlyStreamLabel(matchingMprisStreamLabel(label, players)
    || unmatchedMprisStreamLabel(label, players, streams)
    || label) || t("audio.stream", "Stream")
}

function streamRepresentsPlayer(node, player, players, streams) {
  if (!node || !player) return false
  var playerLabel = mprisPlayerLabel(player)
  if (!playerLabel) return false

  var label = rawStreamLabel(node)
  if (!streamLabelIsGeneric(label)) return streamRepresentsMprisPlayer(label, playerLabel)
  return streamRepresentsMprisPlayer(streamLabel(node, players, streams), playerLabel)
}

// Audio Focus: the per-stream name to show under the app name. Firefox-based
// browsers (Zen) set media.name to the tab's page title and keep it current;
// Chromium uses a generic "Playback". Return "" when there is nothing useful:
// no name, a generic one, or one that just repeats the app label.
var genericStreamNames = {
  "": true, "audiostream": true, "audio stream": true, "playback": true,
  "audio-src": true, "audiocallbackdriver": true, "output": true,
  "stream": true, "sound": true, "audio": true, "playstream": true,
  "simple directmedia layer": true, "alsa playback": true
}

function streamDetail(node, appLabel) {
  if (!node) return ""
  var p = nodeProps(node)
  var name = String(p["media.name"] || "").replace(/\s+/g, " ").trim()
  var key = name.toLowerCase()
  if (genericStreamNames[key]) return ""
  if (/^audio stream #?\d+$/.test(key)) return ""
  var app = String(appLabel || "").trim().toLowerCase()
  if (app && key === app) return ""
  if (name.length > 200) name = name.slice(0, 200)
  return name
}

// Audio Focus: colour for a selected (wheel-armed) slider. The theme accent when
// it stands out from the bar text; otherwise the first theme colour that does
// (cyan, then blue, green, yellow, then the numbered ANSI slots). Some themes
// paint the bar text in the accent colour, which made "selected" invisible.
function parsePalette(text) {
  var out = {}
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length && i < 400; i++) {
    var m = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*=\s*["']?#([0-9A-Fa-f]{6})\b/)
    if (m) out[m[1]] = "#" + m[2].toLowerCase()
  }
  return out
}

function rgbOf(value) {
  var s = String(value || "").trim()
  var m = s.match(/^#(?:[0-9A-Fa-f]{2})?([0-9A-Fa-f]{6})$/)
  if (!m) return null
  var n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function colorDistance(a, b) {
  var x = rgbOf(a), y = rgbOf(b)
  if (!x || !y) return 0
  var dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function pickArmedColor(palette, foreground, accent, background) {
  var pal = palette || {}
  var order = [accent, pal.accent, pal.cyan, pal.blue, pal.green, pal.yellow,
               pal.color6, pal.color4, pal.color2, pal.color3, pal.bright_cyan, pal.bright_blue]
  for (var i = 0; i < order.length; i++) {
    var c = order[i]
    if (!rgbOf(c)) continue
    if (colorDistance(c, foreground) < 100) continue
    if (background && colorDistance(c, background) < 100) continue
    return "#" + rgbOf(c).map(function(v) { return ("0" + v.toString(16)).slice(-2) }).join("")
  }
  return String(accent || foreground || "")
}

// Quickshell types only exact media classes, so a virtual source (an
// Audio/Source/Virtual, such as EasyEffects' or a platform's microphone
// mapping) is a node with no PwNode.audio. PulseAudio lists it as a source, so
// the source availability listing names it; a non-stream node it names is one.
function isUntypedSource(node, sourceAvailability) {
  if (!node || node.audio || node.isStream || node.isSink) return false
  var name = String(node.name || "")
  return name !== "" && !!sourceAvailability && Object.prototype.hasOwnProperty.call(sourceAvailability, name)
}

if (typeof module !== "undefined") {
  module.exports = {
    isPlaybackStream: isPlaybackStream,
    isAudioSource: isAudioSource,
    nodeRow: nodeRow,
    rowSnapshot: rowSnapshot,
    outputVolumeName: outputVolumeName,
    parseSinkAvailability: parseSinkAvailability,
    friendlyDeviceLabel: friendlyDeviceLabel,
    nodeProps: nodeProps,
    nodeLabel: nodeLabel,
    isHeadphones: isHeadphones,
    sinkGlyph: sinkGlyph,
    sourceGlyph: sourceGlyph,
    friendlyStreamLabel: friendlyStreamLabel,
    streamLabelKey: streamLabelKey,
    streamLabelIsGeneric: streamLabelIsGeneric,
    rawStreamLabel: rawStreamLabel,
    mprisPlayerLabel: mprisPlayerLabel,
    mprisPlayerIsProxy: mprisPlayerIsProxy,
    streamRepresentsMprisPlayer: streamRepresentsMprisPlayer,
    mprisLabelsFor: mprisLabelsFor,
    matchingMprisStreamLabel: matchingMprisStreamLabel,
    unmatchedMprisStreamLabel: unmatchedMprisStreamLabel,
    streamLabel: streamLabel,
    streamRepresentsPlayer: streamRepresentsPlayer,
    isUntypedSource: isUntypedSource,
    streamDetail: streamDetail,
    parsePalette: parsePalette,
    colorDistance: colorDistance,
    pickArmedColor: pickArmedColor
  }
}
