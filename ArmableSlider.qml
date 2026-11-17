import QtQuick
import qs.Ui
import qs.Commons
import qs.Commons as Commons

// Omarchy's PanelSlider (qs.Ui) with a selectable scroll wheel.
//
// The stock slider takes every wheel event that lands on it, so scrolling a
// long panel stops dead whenever a slider passes under the pointer and moves
// that volume instead. This one only takes the wheel while it is armed
// (selected in the panel) or while Ctrl is held. Everything else is handed
// back, unaccepted, so the panel's ScrollView scrolls.
//
// Other differences from upstream ($OMARCHY_PATH/shell/Ui/PanelSlider.qml):
// touchpad deltas accumulate through Util.wheelSteps (one notch, one step) the
// way the bar icon already does, a sideways tilt no longer counts as "down",
// and the unused tick marks are gone.
Item {
  id: root

  property QtObject bar: null
  property real value: 0
  property real minimum: 0
  property real maximum: 1
  property real step: 0.05
  property bool integer: false
  property color trackColor: bar ? Style.selectedFillFor(bar.foreground, Commons.Color.accent) : "#333"
  property color fillColor: bar ? bar.foreground : Commons.Color.foreground
  property color knobColor: bar ? bar.foreground : Commons.Color.foreground
  property bool dragging: false
  property real trackHeight: Math.max(4, Math.round(Style.spacing.controlHeight * 0.11))
  property real knobSize: Math.max(14, Math.round(Style.spacing.controlHeight * 0.38))
  property real liveValue: value

  // Selected for the wheel. The fill and knob take armedColor while it is.
  property bool armed: false
  property color armedColor: Commons.Color.accent
  // When the panel last scrolled (Date.now() ms). A page scroll in progress
  // keeps going even when it carries the armed slider under the pointer;
  // the wheel moves it again once the page has been still for scrollSettleMs.
  property real pageScrollAt: 0
  readonly property int scrollSettleMs: 450
  property real wheelRemainder: 0

  onValueChanged: if (!dragging) liveValue = value

  signal moved(real value)
  signal released(real value)
  signal rightClicked()
  // A left press on the track; the panel arms this slider.
  signal activated()

  implicitWidth: Style.space(200)
  implicitHeight: Math.max(Style.space(22), knobSize + Style.spacing.md)

  readonly property real range: Math.max(0.0001, maximum - minimum)
  readonly property real progress: Math.max(0, Math.min(1, (liveValue - minimum) / range))
  readonly property bool _hot: mouseArea.containsMouse || root.dragging
  readonly property bool mirrored: LayoutMirroring.enabled
  function trackX(fraction) {
    return track.x + track.width * (root.mirrored ? 1 - fraction : fraction)
  }

  function wheelWanted(wheel) {
    if (wheel.modifiers & Qt.ControlModifier) return true
    if (!root.armed) return false
    return Date.now() - root.pageScrollAt >= root.scrollSettleMs
  }

  // Shared with the row around the slider, so a selected row answers the
  // wheel anywhere on it, not only on the thin track. Leaves the event
  // unaccepted when the slider does not want it.
  function handleWheel(wheel) {
    var delta = wheel.angleDelta.y
    if (delta === 0 || !root.wheelWanted(wheel)) {
      wheel.accepted = false
      return
    }
    var notch = Util.wheelSteps(root.wheelRemainder, delta)
    root.wheelRemainder = notch.remainder
    if (notch.steps === 0) return
    var next = Math.max(root.minimum, Math.min(root.maximum, root.liveValue + notch.steps * root.step))
    if (root.integer) next = Math.round(next)
    root.liveValue = next
    root.moved(next)
    root.released(next)
  }

  Rectangle {
    id: track
    anchors.verticalCenter: parent.verticalCenter
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.leftMargin: root.knobSize / 2
    anchors.rightMargin: root.knobSize / 2
    height: root.trackHeight
    radius: height / 2
    color: root.trackColor
  }

  Rectangle {
    id: fill
    anchors.verticalCenter: track.verticalCenter
    anchors.left: track.left
    height: track.height
    radius: track.radius
    color: root.armed ? root.armedColor : root.fillColor
    width: track.width * root.progress

    Behavior on width {
      enabled: !root.dragging
      NumberAnimation { duration: Style.duration(140); easing.type: Easing.OutCubic }
    }
  }

  BorderSurface {
    id: knob
    width: root.knobSize
    height: root.knobSize
    radius: root.knobSize / 2
    color: root.armed ? root.armedColor : root.knobColor
    borderSpec: Border.flat(root.bar ? root.bar.background : "#101315", Math.max(1, Style.space(2)))
    anchors.verticalCenter: track.verticalCenter
    x: root.trackX(root.progress) - width / 2
    scale: root._hot ? 1.15 : 1.0

    Behavior on x {
      enabled: !root.dragging
      NumberAnimation { duration: Style.duration(140); easing.type: Easing.OutCubic }
    }

    Behavior on scale {
      NumberAnimation { duration: Style.duration(110); easing.type: Easing.OutCubic }
    }
  }

  MouseArea {
    id: mouseArea
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton

    function valueFromX(x) {
      if (track.width <= 0) return root.minimum
      var fraction = Math.max(0, Math.min(1, (x - track.x) / track.width))
      if (root.mirrored) fraction = 1 - fraction
      var raw = root.minimum + fraction * root.range
      if (root.integer) raw = Math.round(raw)
      return Math.max(root.minimum, Math.min(root.maximum, raw))
    }

    onPressed: function(mouse) {
      if (mouse.button !== Qt.LeftButton) return
      root.activated()
      root.dragging = true
      var next = valueFromX(mouse.x)
      root.liveValue = next
      root.moved(next)
    }
    onClicked: function(mouse) {
      if (mouse.button === Qt.RightButton) root.rightClicked()
    }
    onPositionChanged: function(mouse) {
      if (!root.dragging) return
      var next = valueFromX(mouse.x)
      root.liveValue = next
      root.moved(next)
    }
    onReleased: function(mouse) {
      if (mouse.button !== Qt.LeftButton) return
      root.dragging = false
      root.released(root.liveValue)
      root.liveValue = root.value
    }
    onWheel: function(wheel) { root.handleWheel(wheel) }
  }
}
