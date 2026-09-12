"""Writes the GridSense redesign artboards. Re-run after any edit, then re-seed."""
import json, math, pathlib

# ---------------------------------------------------------------- chart maths
def _curves(days=3, w=800, h=200, pad=10):
    pts = days * 48
    sched, fore, dots = [], [], []
    for i in range(pts + 1):
        day = i / 48
        hour = (day % 1) * 24
        clear = 0.0 if hour <= 6 or hour >= 18 else math.sin(math.pi * (hour - 6) / 12) ** 1.4
        cloud = 1.0
        if 1.30 < day < 1.86:                     # cloud bank on day two
            cloud = 0.16 + 0.1 * math.sin(day * 20)
        elif 0.36 < day < 0.60:
            cloud = 0.72
        s, f = clear * 0.97, clear * cloud
        x = pad + (i / pts) * (w - 2 * pad)
        sched.append((x, h - pad - s * (h - 2 * pad)))
        fore.append((x, h - pad - f * (h - 2 * pad)))
        if s > 0.12 and (s - f) / s > 0.05 and i % 4 == 0:
            dots.append((x, h - pad - f * (h - 2 * pad)))
    line = lambda ps: "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in ps)
    hi = [(x, h - pad - (h - pad - y) * 1.05) for x, y in sched]
    lo = [(x, h - pad - (h - pad - y) * 0.95) for x, y in reversed(sched)]
    return line(sched), line(fore), line(hi + lo) + " Z", dots

SCHED, FORE, BAND, DOTS = _curves()

def chart(h=200, dots=True, labels=True):
    w = 800
    dot_svg = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="#bd2f26" />' for x, y in DOTS) if dots else ""
    grid = "".join(f'<line x1="{10 + (i/3)*(w-20):.1f}" y1="6" x2="{10 + (i/3)*(w-20):.1f}" y2="{h-18}" stroke="#e6ebe8" />' for i in (1, 2))
    day_labels = ""
    if labels:
        for i, name in enumerate(("Today", "Tomorrow", "Monday")):
            day_labels += f'<text x="{16 + (i/3)*(w-20):.1f}" y="{h-4}" font-size="11" fill="#78877f" font-family="Inter, sans-serif">{name}</text>'
    scale = h / 200
    return (f'<svg viewBox="0 0 {w} {h}" style="width:100%; height:{h}px; display:block;" role="img"'
            f' aria-label="Expected generation against the schedule for the next three days">'
            f'<g transform="scale(1 {scale:.3f})">{grid}<path d="{BAND}" fill="#fdf3e1" />'
            f'<path d="{SCHED}" fill="none" stroke="#a86c05" stroke-width="1.6" stroke-dasharray="6 4" />'
            f'<path d="{FORE}" fill="none" stroke="#0f7a58" stroke-width="2.4" stroke-linejoin="round" />{dot_svg}</g>{day_labels}</svg>')

def legend():
    def key(colour, label, dashed=False, block=False):
        mark = (f'<span style="width:16px; height:10px; border-radius:3px; background:{colour};"></span>' if block else
                f'<span style="width:18px; height:0; border-top:2px {"dashed" if dashed else "solid"} {colour};"></span>')
        return f'<span style="display:flex; align-items:center; gap:7px;">{mark}{label}</span>'
    return ('<div style="display:flex; gap:18px; flex-wrap:wrap; font-size:12.5px; color:#48584f;">'
            + key("#0f7a58", "What we expect you to make")
            + key("#a86c05", "What you promised", dashed=True)
            + key("#fdf3e1", "Allowed margin", block=True)
            + '<span style="display:flex; align-items:center; gap:7px;"><span style="width:9px; height:9px; border-radius:50%; background:#bd2f26;"></span>Costs money</span></div>')

# ---------------------------------------------------------------- shared shell
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">')
CSS = """
    body { margin: 0; background: #f5f7f6; color: #0f1a16; font-family: Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: #0f7a58; text-decoration: none; } a:hover { color: #0a5c42; }
    .mono { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .dsp { font-family: "Space Grotesk", Inter, sans-serif; letter-spacing: -0.03em; }
"""
CARD = "background:#ffffff; border:1px solid #e6ebe8; border-radius:14px; box-shadow:0 1px 2px rgba(15,26,22,0.05);"
MARK = ('<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#e7f4ef" stroke="#0f7a58" stroke-width="1.4" />'
        '<path d="M6 20 C10 20 11 9 16 9 S22 20 26 20" fill="none" stroke="#0f7a58" stroke-width="2.2" stroke-linecap="round" /><circle cx="16" cy="9" r="2.5" fill="#a86c05" /></svg>')

def button(label, kind="primary", height=38):
    if kind == "primary":
        style = "background:#0f7a58; border:1px solid #0f7a58; color:#ffffff;"
    else:
        style = "background:#ffffff; border:1px solid #d3ddd7; color:#0f1a16;"
    return (f'<button style="height:{height}px; padding:0 16px; border-radius:10px; {style} font-size:14px;'
            f' font-weight:600; font-family:inherit; cursor:pointer;">{label}</button>')

def topbar(active="Today", plant="Ahmedabad Solar Park · 50 MW", action="Update forecast"):
    links = ""
    for name in ("Today", "Forecast", "Trust"):
        on = name == active
        links += (f'<span style="padding:7px 12px; border-radius:9px; font-size:14.5px; font-weight:{600 if on else 500};'
                  f' color:{"#0a5c42" if on else "#48584f"}; background:{"#e7f4ef" if on else "transparent"};">{name}</span>')
    return f'''<header style="display:flex; align-items:center; gap:22px; height:64px; padding:0 28px; background:#ffffff; border-bottom:1px solid #e6ebe8;">
  <div style="display:flex; align-items:center; gap:9px;">{MARK}<span class="dsp" style="font-size:18px; font-weight:700;">Grid<span style="color:#0f7a58;">Sense</span></span></div>
  <nav style="display:flex; gap:4px;">{links}</nav>
  <div style="flex-grow:1;"></div>
  <span style="font-size:13.5px; color:#48584f;">{plant}</span>
  {button(action)}
</header>'''

def page(inner, height=1000, active="Today", plant="Ahmedabad Solar Park · 50 MW", action="Update forecast", width=1440):
    return f'''<div style="width:{width}px; min-height:{height}px; background:#f5f7f6; display:flex; flex-direction:column;">
{topbar(active, plant, action)}
<main style="width:100%; max-width:880px; margin:0 auto; padding:36px 24px 56px; display:flex; flex-direction:column; gap:26px;">
{inner}
</main>
</div>'''

def doc(body, script=None, preview=(1440, 1000)):
    tail = ""
    if script:
        props = json.dumps({"$preview": {"width": preview[0], "height": preview[1]}}).replace("'", "&#39;")
        tail = f"\n<script data-dc-script data-props='{props}'>\n{script}\n</script>"
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  {FONTS}
  <style>{CSS}</style>
</helmet>
{body}
</x-dc>{tail}
</body>
</html>
'''

def verdict(amount, line, sub, colour="#bd2f26", eyebrow="Ahmedabad Solar Park · next 3 days"):
    return f'''<section>
  <p style="margin:0; font-size:14px; color:#78877f; font-weight:500;">{eyebrow}</p>
  <h1 class="dsp" style="margin:8px 0 0; font-size:54px; line-height:1.04; color:{colour};">{amount}</h1>
  <p class="dsp" style="margin:6px 0 0; font-size:23px; line-height:1.25; color:#0f1a16; font-weight:500;">{line}</p>
  <p style="margin:14px 0 0; max-width:640px; font-size:16px; line-height:1.6; color:#48584f;">{sub}</p>
</section>'''

def trust_footer():
    return f'''<section style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:15px 18px; {CARD} font-size:13.5px; color:#48584f;">
  <span>Our forecast is out by <strong class="mono" style="color:#0f1a16;">0.3 MW</strong> on a typical quarter-hour. Guessing is out by <strong class="mono" style="color:#0f1a16;">1.2 MW</strong>.</span>
  <span style="color:#d3ddd7;">|</span>
  <span>Priced at <strong class="mono" style="color:#0f1a16;">₹3</strong>/unit, <strong class="mono" style="color:#0f1a16;">±5%</strong> allowed free.</span>
  <span style="flex-grow:1;"></span>
  <a href="#" style="font-weight:600;">How we know &rsaquo;</a>
</section>'''

def section_head(title, note=None):
    n = f'<p style="margin:4px 0 0; font-size:13.5px; color:#78877f;">{note}</p>' if note else ""
    return f'<div><h2 class="dsp" style="margin:0; font-size:19px; font-weight:600;">{title}</h2>{n}</div>'

# ---------------------------------------------------------------- the queue
ROWS = [
    dict(kind="equipment", when="Since Tue", money="₹27,803", strong=True,
         title="Inverter 3 is producing 11% less than it should",
         sub="Sunshine does not explain it, so the panels are probably dirty",
         lines=[("Electricity lost so far", "9,268 units"), ("Worth", "₹27,803 at ₹3 a unit"),
                ("First slipped", "Tue 8 Sept, 10:00 am"), ("Still happening", "Yes, every clear day since")],
         action="Clean the panels on inverter 3. Left alone it costs about ₹6,900 a week."),
    dict(kind="block", when="Mon 11:00", money="₹7,286", strong=True,
         title="You make 89% less than you promised",
         sub="A cloud bank sits over the plant for this quarter-hour",
         lines=[("You promised the grid", "12,125 units"), ("We expect you to make", "1,320 units"),
                ("Allowed to miss, free", "606 units (±5%)"), ("Charged", "9,746 units at ₹0.75")],
         action="Discharge storage to cover the gap, or lower your promise before the gate closes."),
    dict(kind="block", when="Mon 11:15", money="₹7,129",
         title="You make 86% less than you promised", sub="Same cloud bank, next quarter-hour",
         lines=[("You promised the grid", "12,020 units"), ("We expect you to make", "1,690 units"),
                ("Allowed to miss, free", "601 units (±5%)"), ("Charged", "9,505 units at ₹0.75")],
         action="Same answer: storage, or a lower promise."),
    dict(kind="block", when="Mon 10:45", money="₹7,062",
         title="You make 89% less than you promised", sub="The cloud arrives",
         lines=[("You promised the grid", "11,880 units"), ("We expect you to make", "1,320 units"),
                ("Allowed to miss, free", "594 units (±5%)"), ("Charged", "9,416 units at ₹0.75")],
         action="Storage, or a lower promise."),
    dict(kind="block", when="Sat 13:00", money="₹63",
         title="You make 7% less than you promised", sub="Thin cloud, barely outside the margin",
         lines=[("You promised the grid", "12,125 units"), ("We expect you to make", "11,280 units"),
                ("Allowed to miss, free", "606 units (±5%)"), ("Charged", "239 units at ₹0.25")],
         action="Nothing to do unless it worsens. Watch it."),
]

ICONS = {
    "equipment": ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a86c05" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                  '<path d="M3 21h18" /><path d="M6 21V9l6-5 6 5v12" /><path d="M10 21v-6h4v6" /></svg>'),
    "block": ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bd2f26" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>'),
}

def caret(open_=False):
    return (f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#78877f" stroke-width="2" stroke-linecap="round"'
            f' style="transform:rotate({90 if open_ else 0}deg);"><path d="M9 6l6 6-6 6" /></svg>')

def row_head(r, open_=False):
    tint = "#fdf3e1" if r["kind"] == "equipment" else "#fdeceb"
    money_colour = "#bd2f26" if r.get("strong") else "#0f1a16"
    return f'''<div style="display:grid; grid-template-columns:34px 88px minmax(0,1fr) 108px 18px; align-items:center; gap:14px; padding:15px 18px; cursor:pointer;">
  <span style="display:grid; place-items:center; width:34px; height:34px; border-radius:10px; background:{tint};">{ICONS[r["kind"]]}</span>
  <span class="mono" style="font-size:13px; color:#78877f;">{r["when"]}</span>
  <span style="min-width:0; font-size:15.5px; font-weight:500; line-height:1.35;">{r["title"]}</span>
  <span class="mono" style="text-align:right; font-size:16px; font-weight:600; color:{money_colour};">{r["money"]}</span>
  {caret(open_)}
</div>'''

def row_body(r):
    lines = "".join(
        f'<div style="display:flex; justify-content:space-between; gap:16px; padding:9px 0; border-bottom:1px solid #e6ebe8;">'
        f'<span style="font-size:13.5px; color:#48584f;">{k}</span>'
        f'<span class="mono" style="font-size:13.5px; font-weight:600;">{v}</span></div>'
        for k, v in r["lines"])
    return f'''<div style="padding:2px 18px 20px 154px;">
  <div style="padding:14px 16px; border-radius:12px; background:#fafbfa; border:1px solid #e6ebe8;">{lines}
    <div style="display:flex; justify-content:space-between; gap:16px; padding:12px 0 2px;">
      <span style="font-size:14px; font-weight:600;">What it costs you</span>
      <span class="mono" style="font-size:20px; font-weight:700; color:#bd2f26;">{r["money"]}</span>
    </div>
  </div>
  <div style="display:flex; align-items:center; gap:12px; margin-top:12px; padding:13px 16px; border-radius:12px; background:#e7f4ef;">
    <span style="font-size:14px; color:#0a5c42;"><strong>Do this:</strong> {r["action"]}</span>
  </div>
</div>'''

def queue_static(open_index=None, rows=None, footer=True):
    rows = rows if rows is not None else ROWS
    out = []
    for i, r in enumerate(rows):
        body = row_body(r) if i == open_index else ""
        border = "" if i == len(rows) - 1 and not footer else "border-bottom:1px solid #e6ebe8;"
        out.append(f'<div style="{border}">{row_head(r, i == open_index)}{body}</div>')
    more = ('<div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; font-size:13.5px; color:#78877f;">'
            '<span>133 more quarter-hours, ₹4.2 lakh between them</span><a href="#" style="font-weight:600;">Show all</a></div>') if footer else ""
    return f'<section style="{CARD} overflow:hidden;">{"".join(out)}{more}</section>'

def chart_card(height=190, note=None):
    note = note or "Each red dot is a quarter-hour that costs money. The amber band is how far you are allowed to miss."
    return f'''<section style="{CARD} padding:20px;">
  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:14px;">
    {section_head("The next three days", note)}
    {legend()}
  </div>
  {chart(height)}
</section>'''

# ---------------------------------------------------------------- 288 blocks
def strip():
    rows_html = []
    for d, label in enumerate(("Today", "Tomorrow", "Monday")):
        cells = []
        for b in range(96):
            hour = b / 4
            clear = 0.0 if hour <= 6 or hour >= 18 else math.sin(math.pi * (hour - 6) / 12) ** 1.4
            cloud = 1.0
            if d == 1 and 30 < b - 18 < 54:
                cloud = 0.16
            elif d == 0 and 34 < b - 18 < 58:
                cloud = 0.72
            if clear < 0.02:
                style = "background:#f0f3f1;"
            else:
                gap = (clear * 0.97 - clear * cloud) / (clear * 0.97)
                if gap > 0.05:
                    heat = min(1.0, (gap - 0.05) / 0.8)
                    style = f"background:color-mix(in oklab, #e9a13b, #bd2f26 {heat*100:.0f}%);"
                else:
                    style = f"background:rgba(15,122,88,{0.16 + clear * 0.6:.2f});"
            cells.append(f'<i style="display:block; height:26px; border-radius:2px; {style}"></i>')
        rows_html.append(
            f'<div style="display:grid; grid-template-columns:76px minmax(0,1fr); align-items:center; gap:12px;">'
            f'<span style="font-size:12.5px; color:#48584f; font-weight:500;">{label}</span>'
            f'<div style="display:grid; grid-template-columns:repeat(96, minmax(0,1fr)); gap:2px;">{"".join(cells)}</div></div>')
    hours = "".join(f'<span>{h:02d}:00</span>' for h in (0, 3, 6, 9, 12, 15, 18, 21))
    return f'''<section style="{CARD} padding:20px;">
  {section_head("Every quarter-hour, side by side", "288 blocks. Hover one for its numbers; click to open it in the list above.")}
  <div style="display:grid; grid-template-columns:76px minmax(0,1fr); gap:12px; margin:16px 0 8px;">
    <span></span><div style="display:grid; grid-template-columns:repeat(8, 1fr); font-size:11px; color:#78877f;" class="mono">{hours}</div>
  </div>
  <div style="display:flex; flex-direction:column; gap:6px;">{"".join(rows_html)}</div>
</section>'''

# ---------------------------------------------------------------- artboards
def write(name, body, script=None, preview=(1440, 1000)):
    pathlib.Path(name).write_text(doc(body, script, preview))

# 1. Today (interactive)
ROW_TEMPLATE = '''<sc-for list="{{rows}}" as="row" hint-placeholder-count="5">
      <div style="border-bottom:1px solid #e6ebe8;">
        <div onClick="{{row.toggle}}" style="display:grid; grid-template-columns:34px 88px minmax(0,1fr) 108px 18px; align-items:center; gap:14px; padding:15px 18px; cursor:pointer;">
          <span style="display:grid; place-items:center; width:34px; height:34px; border-radius:10px; background:{{row.tint}};">
            <sc-if value="{{row.isEquipment}}" hint-placeholder-val="{{ true }}">ICON_EQUIP</sc-if>
            <sc-if value="{{row.isBlock}}" hint-placeholder-val="{{ false }}">ICON_BLOCK</sc-if>
          </span>
          <span class="mono" style="font-size:13px; color:#78877f;">{{row.when}}</span>
          <span style="min-width:0; font-size:15.5px; font-weight:500; line-height:1.35;">{{row.title}}</span>
          <span class="mono" style="text-align:right; font-size:16px; font-weight:600; color:{{row.moneyColour}};">{{row.money}}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#78877f" stroke-width="2" stroke-linecap="round" style="transform:rotate({{row.caret}}deg);"><path d="M9 6l6 6-6 6" /></svg>
        </div>
        <sc-if value="{{row.open}}" hint-placeholder-val="{{ false }}">
          <div style="padding:2px 18px 20px 154px;">
            <div style="padding:14px 16px; border-radius:12px; background:#fafbfa; border:1px solid #e6ebe8;">
              <sc-for list="{{row.lines}}" as="line" hint-placeholder-count="4">
                <div style="display:flex; justify-content:space-between; gap:16px; padding:9px 0; border-bottom:1px solid #e6ebe8;">
                  <span style="font-size:13.5px; color:#48584f;">{{line.k}}</span>
                  <span class="mono" style="font-size:13.5px; font-weight:600;">{{line.v}}</span>
                </div>
              </sc-for>
              <div style="display:flex; justify-content:space-between; gap:16px; padding:12px 0 2px;">
                <span style="font-size:14px; font-weight:600;">What it costs you</span>
                <span class="mono" style="font-size:20px; font-weight:700; color:#bd2f26;">{{row.money}}</span>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px; margin-top:12px; padding:13px 16px; border-radius:12px; background:#e7f4ef;">
              <span style="font-size:14px; color:#0a5c42;"><strong>Do this:</strong> {{row.action}}</span>
            </div>
          </div>
        </sc-if>
      </div>
    </sc-for>'''.replace("ICON_EQUIP", ICONS["equipment"]).replace("ICON_BLOCK", ICONS["block"])

MAIN_LOGIC = """class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { open: null };
  }

  renderVals() {
    const open = this.state.open;
    return {
      rows: ROWS.map((r, i) => ({
        ...r,
        isEquipment: r.kind === 'equipment',
        isBlock: r.kind === 'block',
        tint: r.kind === 'equipment' ? '#fdf3e1' : '#fdeceb',
        moneyColour: r.strong ? '#bd2f26' : '#0f1a16',
        caret: open === i ? 90 : 0,
        open: open === i,
        toggle: () => this.setState({ open: open === i ? null : i }),
      })),
    };
  }
}"""

VERDICT_SUB = ('About <strong style="color:#0f1a16;">₹60 lakh a year</strong> at this rate, '
               'arriving a few thousand rupees at a time.')

main_inner = "\n".join([
    verdict("₹4.9 lakh", "at risk over the next three days", VERDICT_SUB),
    f'<section style="{CARD} overflow:hidden;">{ROW_TEMPLATE}'
    '<div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; font-size:13.5px; color:#78877f;">'
    '<span>133 more quarter-hours, ₹4.2 lakh between them</span><a href="#" style="font-weight:600;">Show all</a></div></section>',
])
write("Main.dc.html", page(main_inner, height=760),
      script="const ROWS = " + json.dumps(ROWS, ensure_ascii=False) + ";\n\n" + MAIN_LOGIC, preview=(1440, 760))

# 2. Today with a row open (static, for the canvas)
open_inner = "\n".join([
    verdict("₹4.9 lakh", "at risk over the next three days", VERDICT_SUB),
    queue_static(open_index=1),
])
write("TodayOpen.dc.html", page(open_inner, height=940))

# 3. Rooftop
roof_cards = f'''<div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:16px;">
  <section style="{CARD} padding:20px;">
    <p style="margin:0; font-size:13.5px; color:#78877f; font-weight:500;">Best time to run the washing machine</p>
    <p class="mono dsp" style="margin:8px 0 0; font-size:30px; font-weight:600;">10:45 – 13:45</p>
    <p style="margin:8px 0 0; font-size:13.5px; color:#48584f;">Tomorrow. You make about 8.3 units in that window — enough for a wash, the dishwasher and the geyser.</p>
  </section>
  <section style="{CARD} padding:20px;">
    <p style="margin:0; font-size:13.5px; color:#78877f; font-weight:500;">Your panels</p>
    <p class="dsp" style="margin:8px 0 0; font-size:30px; font-weight:600; color:#0f7a58;">Healthy</p>
    <p style="margin:8px 0 0; font-size:13.5px; color:#48584f;">Output has matched the sunshine every day this week. We will tell you the day it stops.</p>
  </section>
</div>'''
roof_inner = "\n".join([
    verdict("₹4,579", "off your electricity bill this month",
            'Your 3 kW rooftop makes about <strong style="color:#0f1a16;">19 units a day</strong>. Use them while the sun is up and you buy nothing from the grid.',
            colour="#0f7a58", eyebrow="Rooftop, Ahmedabad · next 3 days"),
    roof_cards,
    f'<section style="{CARD} padding:20px;"><p style="margin:0 0 12px; font-size:13.5px; color:#78877f; font-weight:500;">'
    f'When your panels will be busy</p>{chart(150, dots=False)}</section>',
])
write("Rooftop.dc.html", page(roof_inner, height=820, plant="Rooftop 3 kW · Ahmedabad"))

# 4. Forecast detail
horizon = ('<div style="display:inline-flex; padding:3px; border-radius:10px; background:#fafbfa; border:1px solid #e6ebe8;">'
           + "".join(f'<span style="padding:6px 14px; border-radius:8px; font-size:13px; font-weight:600; '
                     f'color:{"#0a5c42" if h == "72 hours" else "#48584f"}; background:{"#ffffff" if h == "72 hours" else "transparent"};'
                     f'{" box-shadow:0 1px 2px rgba(15,26,22,0.05);" if h == "72 hours" else ""}">{h}</span>'
                     for h in ("24 hours", "48 hours", "72 hours")) + "</div>")
fc_inner = "\n".join([
    f'<section style="display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap;">'
    f'<div><h1 class="dsp" style="margin:0; font-size:34px; font-weight:700;">What you will generate</h1>'
    f'<p style="margin:10px 0 0; max-width:620px; font-size:15.5px; color:#48584f;">Read from the weather at your plant, quarter-hour by quarter-hour. '
    f'The amber line is the promise you filed; anywhere the green line leaves the amber band, you pay.</p></div>{horizon}</section>',
    chart_card(250),
    strip(),
])
write("Forecast.dc.html", page(fc_inner, height=1120, active="Forecast"))
print("main, today-open, rooftop, forecast written")

# 5. Trust
def bar(label, value, pct, colour):
    return f'''<div style="display:grid; grid-template-columns:96px minmax(0,1fr) 74px; align-items:center; gap:14px;">
  <span style="font-size:13.5px; color:#48584f;">{label}</span>
  <span style="display:block; height:14px; border-radius:7px; background:#f0f3f1;"><i style="display:block; width:{pct}%; height:100%; border-radius:7px; background:{colour};"></i></span>
  <span class="mono" style="text-align:right; font-size:14px; font-weight:600;">{value}</span>
</div>'''

def facts():
    items = [("Checked on", "269 quarter-hours"), ("Learned from", "1,075 quarter-hours"),
             ("Method", "Gradient-boosted trees"), ("Last trained", "Today, 11:23 am")]
    cells = "".join(f'<div style="padding:11px 13px; border-radius:10px; background:#fafbfa; border:1px solid #e6ebe8;">'
                    f'<div style="font-size:12px; color:#78877f; font-weight:600;">{k}</div>'
                    f'<div class="mono" style="margin-top:3px; font-size:14px; font-weight:600;">{v}</div></div>' for k, v in items)
    return f'<div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; margin-top:18px;">{cells}</div>'

def field(label, prefix, value, suffix, note):
    return f'''<div>
  <label style="display:block; margin-bottom:7px; font-size:13px; font-weight:600; color:#48584f;">{label}</label>
  <div style="display:flex; align-items:center; gap:7px; height:46px; padding:0 13px; border-radius:10px; border:1px solid #d3ddd7; background:#ffffff; color:#78877f;">
    <span>{prefix}</span><span class="mono" style="flex-grow:1; font-size:16px; font-weight:600; color:#0f1a16;">{value}</span><span>{suffix}</span>
  </div>
  <p style="margin:7px 0 0; font-size:12px; color:#78877f;">{note}</p>
</div>'''

slab_rows = "".join(
    f'<tr><td style="padding:9px 12px; border-bottom:1px solid #e6ebe8; font-size:13.5px;">{a}</td>'
    f'<td class="mono" style="padding:9px 12px; border-bottom:1px solid #e6ebe8; font-size:13.5px; text-align:right;">{b}</td></tr>'
    for a, b in (("Inside ±5%", "free"), ("up to 15% out", "₹0.25"), ("up to 25% out", "₹0.50"), ("further out", "₹0.75")))

trust_inner = "\n".join([
    '<section><h1 class="dsp" style="margin:0; font-size:34px; font-weight:700;">Can you trust these numbers?</h1>'
    '<p style="margin:10px 0 0; max-width:660px; font-size:15.5px; color:#48584f;">Every rupee on the other two screens comes from one forecast and one set of rules. '
    'Here is how well the forecast does, and exactly which rules were applied. Change them and everything re-prices.</p></section>',
    f'''<section style="{CARD} padding:22px;">
  {section_head("How far off are we, typically?")}
  <div style="display:flex; flex-direction:column; gap:10px; margin:18px 0 16px;">
    {bar("GridSense", "0.3 MW", 25, "#0f7a58")}
    {bar("Guessing", "1.2 MW", 100, "#c9d3ce")}
  </div>
  <p style="margin:0; font-size:14.5px; line-height:1.6; color:#48584f;">On a typical quarter-hour we miss by <strong style="color:#0f1a16;">0.3 MW</strong>.
  Assuming today repeats tomorrow — the simplest forecast anyone can make — misses by <strong style="color:#0f1a16;">1.2 MW</strong>.
  That makes us <strong style="color:#0f1a16;">74% closer</strong>.</p>
  {facts()}
</section>''',
    f'''<section style="{CARD} padding:22px;">
  {section_head("What the forecast pays attention to", "You can see what drives a prediction, which matters when you have to justify a revised promise to the dispatch centre.")}
  <div style="display:flex; flex-direction:column; gap:10px; margin-top:18px;">
    {bar("Sunlight", "78%", 78, "#0f7a58")}
    {bar("Air temperature", "17%", 17, "#0f7a58")}
    {bar("Cloud cover", "5%", 5, "#0f7a58")}
  </div>
</section>''',
    f'''<section style="{CARD} padding:22px;">
  {section_head("The rules we applied", "These are not our numbers to choose. Put in your own and every figure in the app is recalculated.")}
  <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)) auto; gap:18px; align-items:end; margin:18px 0 20px;">
    {field("What your electricity sells for", "₹", "3.00", "/ unit", "Used to price what a faulty inverter loses.")}
    {field("How far you may miss, free", "±", "5.0", "%", "The regulator's figure for solar.")}
    <div style="padding-bottom:22px;">{button("Apply and re-price")}</div>
  </div>
  <table style="width:100%; border-collapse:collapse;">
    <caption style="text-align:left; padding-bottom:8px; font-size:13px; color:#78877f;">What being outside the margin costs, per unit</caption>
    <thead><tr>
      <th style="padding:9px 12px; border-bottom:1px solid #e6ebe8; font-size:12px; color:#78877f; text-align:left;">How far outside</th>
      <th style="padding:9px 12px; border-bottom:1px solid #e6ebe8; font-size:12px; color:#78877f; text-align:right;">Rate</th>
    </tr></thead>
    <tbody>{slab_rows}</tbody>
  </table>
  <p style="margin:14px 0 0; font-size:12.5px; color:#78877f;">Surplus you did not promise earns nothing once grid frequency reaches 50.05 Hz.
  These are decision-support estimates from the published slab structure, not settlement statements.</p>
</section>''',
])
write("Trust.dc.html", page(trust_inner, height=1160, active="Trust"))

# 6. New plant
def step(n, title, body, cta, done=False):
    tint = "#e7f4ef" if not done else "#f0f3f1"
    return f'''<div style="display:grid; grid-template-columns:38px minmax(0,1fr); gap:16px; align-items:start;">
  <span class="mono" style="display:grid; place-items:center; width:38px; height:38px; border-radius:50%; background:{tint}; color:#0a5c42; font-weight:600;">{n}</span>
  <div>
    <p class="dsp" style="margin:0; font-size:19px; font-weight:600;">{title}</p>
    <p style="margin:6px 0 14px; font-size:14.5px; color:#48584f; max-width:520px;">{body}</p>
    {cta}
  </div>
</div>'''

new_inner = "\n".join([
    verdict("Kutch Solar 2 is on the map", "two things left before it can save you money",
            'We have the coordinates and the size. Now we need a forecast, and the promise you make to the grid.',
            colour="#0f1a16", eyebrow="New plant · Kutch, Gujarat · 25 MW"),
    f'''<section style="{CARD} padding:26px; display:flex; flex-direction:column; gap:26px;">
  {step(1, "Forecast the next three days", "We read the weather at 23.24°N, 69.67°E and work out what your panels will make, quarter-hour by quarter-hour. Takes a few seconds.", button("Forecast the next 3 days"))}
  <div style="height:1px; background:#e6ebe8;"></div>
  {step(2, "Tell the grid what you promise", "Deviation charges compare what you make against what you promised. File this forecast as that promise and every quarter-hour gets priced.", button("Available after step 1", "ghost"), done=True)}
</section>''',
    f'<section style="{CARD} padding:16px 18px; font-size:13.5px; color:#48584f;">Nothing here is charged until a promise exists. '
    'Until then GridSense will only show you what the plant is expected to make.</section>',
])
write("NewPlant.dc.html", page(new_inner, height=820, plant="Kutch Solar 2 · 25 MW", action="Update forecast"))

# 7. Login
def proof(title, body):
    return (f'<div><p class="dsp" style="margin:0; font-size:16px; font-weight:600;">{title}</p>'
            f'<p style="margin:5px 0 0; font-size:14px; color:#48584f; line-height:1.55;">{body}</p></div>')

demo_buttons = "".join(
    f'<button style="display:flex; align-items:center; gap:9px; height:42px; padding:0 14px; border-radius:10px; border:1px solid #e6ebe8; '
    f'background:#ffffff; font-size:13.5px; font-weight:600; color:#48584f; font-family:inherit; cursor:pointer;">{label}</button>'
    for label in ("Plant owner", "Utility company", "Grid operator", "Energy trader"))

login_body = f'''<div style="width:1440px; min-height:900px; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,0.95fr); background:#ffffff;">
  <section style="display:flex; flex-direction:column; gap:30px; padding:52px 56px; background:linear-gradient(168deg, #e7f4ef 0%, #f3f8f5 52%, #ffffff 100%); border-right:1px solid #e6ebe8;">
    <div style="display:flex; align-items:center; gap:10px;">{MARK}<span class="dsp" style="font-size:19px; font-weight:700;">Grid<span style="color:#0f7a58;">Sense</span></span></div>
    <div style="margin-top:22px;">
      <h1 class="dsp" style="margin:0; font-size:50px; line-height:1.05; font-weight:700;">Know what tomorrow's<br />weather will cost you.</h1>
      <p style="margin:18px 0 0; max-width:470px; font-size:17px; line-height:1.6; color:#48584f;">
        You promise the grid a number. GridSense reads the weather, works out the number you will actually hit, and prices the gap before it happens.</p>
    </div>
    <div style="display:flex; flex-direction:column; gap:20px; margin-top:8px;">
      {proof("Quarter-hour by quarter-hour", "The grid settles in 15-minute blocks, so that is where the money leaks. We price all 288 of them, three days out.")}
      {proof("One list, worst first", "Not a wall of charts. A list of what to fix, ordered by what it costs you.")}
      {proof("Your own numbers", "Tariff and allowed margin are yours to set. Change them and every figure recalculates.")}
    </div>
    <div style="flex-grow:1;"></div>
    <p style="margin:0; font-size:12.5px; color:#78877f;">Built for HackOut&rsquo;26 · CERC deviation rules, in force 31 August 2026</p>
  </section>

  <section style="display:flex; align-items:center; justify-content:center; padding:48px;">
    <div style="width:100%; max-width:394px; display:flex; flex-direction:column; gap:20px;">
      <div>
        <h2 class="dsp" style="margin:0; font-size:26px; font-weight:700;">Welcome back</h2>
        <p style="margin:6px 0 0; font-size:14.5px; color:#78877f;">Sign in to your plant.</p>
      </div>
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="display:block; margin-bottom:7px; font-size:13px; font-weight:600; color:#48584f;">Email</label>
          <div style="height:46px; padding:0 13px; display:flex; align-items:center; border-radius:10px; border:1px solid #d3ddd7; color:#a9b5af; font-size:15px;">you@company.com</div>
        </div>
        <div>
          <label style="display:block; margin-bottom:7px; font-size:13px; font-weight:600; color:#48584f;">Password</label>
          <div style="height:46px; padding:0 13px; display:flex; align-items:center; border-radius:10px; border:1px solid #d3ddd7; color:#a9b5af; font-size:15px;">••••••••••</div>
        </div>
      </div>
      <button style="height:46px; border-radius:10px; border:0; background:#0f7a58; color:#ffffff; font-size:15px; font-weight:600; font-family:inherit; cursor:pointer;">Sign in</button>
      <div style="display:flex; align-items:center; gap:12px; color:#78877f; font-size:12.5px;">
        <span style="flex-grow:1; height:1px; background:#e6ebe8;"></span>or look around first<span style="flex-grow:1; height:1px; background:#e6ebe8;"></span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:9px;">{demo_buttons}</div>
      <p style="margin:0; font-size:12.5px; color:#78877f;">Demo accounts open a real plant with three days of live weather. Nothing you do in them is saved to your account.</p>
    </div>
  </section>
</div>'''
write("Login.dc.html", login_body)

# 8. Mobile
mob_rows = "".join(f'''<div style="display:grid; grid-template-columns:30px minmax(0,1fr) 78px; align-items:center; gap:11px; padding:13px 14px; border-bottom:1px solid #e6ebe8;">
  <span style="display:grid; place-items:center; width:30px; height:30px; border-radius:9px; background:{"#fdf3e1" if r["kind"] == "equipment" else "#fdeceb"};">{ICONS[r["kind"]]}</span>
  <span style="min-width:0;"><span style="display:block; font-size:14px; font-weight:500; line-height:1.3;">{r["title"]}</span>
  <span class="mono" style="display:block; margin-top:2px; font-size:11.5px; color:#78877f;">{r["when"]}</span></span>
  <span class="mono" style="text-align:right; font-size:14.5px; font-weight:600; color:{"#bd2f26" if r.get("strong") else "#0f1a16"};">{r["money"]}</span>
</div>''' for r in ROWS[:3])

mobile_body = f'''<div style="width:390px; min-height:844px; background:#f5f7f6; display:flex; flex-direction:column;">
  <header style="display:flex; align-items:center; gap:9px; height:56px; padding:0 16px; background:#ffffff; border-bottom:1px solid #e6ebe8;">
    {MARK}<span class="dsp" style="font-size:17px; font-weight:700;">Grid<span style="color:#0f7a58;">Sense</span></span>
    <span style="flex-grow:1;"></span>
    <span style="font-size:12.5px; color:#48584f;">Ahmedabad · 50 MW</span>
  </header>
  <main style="padding:20px 16px 28px; display:flex; flex-direction:column; gap:18px;">
    <section>
      <p style="margin:0; font-size:13px; color:#78877f; font-weight:500;">Next 3 days</p>
      <h1 class="dsp" style="margin:6px 0 0; font-size:38px; line-height:1.05; color:#bd2f26;">₹4.9 lakh</h1>
      <p class="dsp" style="margin:4px 0 0; font-size:17px; color:#0f1a16; font-weight:500;">at risk</p>
      <p style="margin:10px 0 0; font-size:14px; line-height:1.55; color:#48584f;">About ₹60 lakh a year, a few thousand rupees at a time.</p>
    </section>
    <button style="height:46px; border-radius:10px; border:0; background:#0f7a58; color:#ffffff; font-size:15px; font-weight:600; font-family:inherit;">Update forecast</button>
    <section style="{CARD} overflow:hidden;">
      <p style="margin:0; padding:13px 14px 11px; font-size:13px; font-weight:600; color:#78877f; border-bottom:1px solid #e6ebe8;">What to do, worst first</p>
      {mob_rows}
      <div style="padding:12px 14px; font-size:13px; color:#78877f;">133 more, ₹4.2 lakh between them</div>
    </section>
  </main>
</div>'''
write("Mobile.dc.html", mobile_body)

# ---------------------------------------------------------------- canvas
canvas = {
    "artboards": [
        {"file": "Login.dc.html", "x": 0, "y": 0, "w": 1440, "h": 900, "title": "1 · Sign in"},
        {"file": "Main.dc.html", "x": 1560, "y": 0, "w": 1440, "h": 760, "title": "2 · Today", "is_interactive": True},
        {"file": "TodayOpen.dc.html", "x": 3120, "y": 0, "w": 1440, "h": 940, "title": "3 · Today, row open"},
        {"file": "Rooftop.dc.html", "x": 4680, "y": 0, "w": 1440, "h": 820, "title": "4 · Today, rooftop owner"},
        {"file": "Forecast.dc.html", "x": 0, "y": 1200, "w": 1440, "h": 1120, "title": "5 · Forecast"},
        {"file": "Trust.dc.html", "x": 1560, "y": 1200, "w": 1440, "h": 1160, "title": "6 · Trust"},
        {"file": "NewPlant.dc.html", "x": 3120, "y": 1200, "w": 1440, "h": 820, "title": "7 · Plant with no forecast yet"},
        {"file": "Mobile.dc.html", "x": 4680, "y": 1200, "w": 390, "h": 760, "title": "8 · Today on a phone"},
    ],
    "annotations": [
        {"id": "note-structure", "x": 0, "y": -150, "w": 520,
         "text": "Three screens, not five.\nToday (everything you act on) · Forecast (what will happen) · Trust (why believe it).\nEquipment problems and costly quarter-hours share ONE list, ordered by money."},
        {"id": "note-today", "x": 1560, "y": -150, "w": 460,
         "text": "Today is now the verdict and the queue, nothing else.\nThe chart moved to Forecast; the panel notes, legend and footer are gone.\nRows are clickable here: open one for the arithmetic and the action."},
        {"id": "note-scale", "x": 3120, "y": -150, "w": 460,
         "text": "Every rupee figure carries its real scale: what it becomes over a year, and what share of revenue that is."},
        {"id": "note-gone", "x": 0, "y": 2420, "w": 620,
         "text": "Gone from the old build: the sidebar, the KPI card row, the duplicate chart and action list, the plain/expert switch, the per-panel explanatory notes, and the row subtitles."},
    ],
    "launch": {"view": "canvas"},
}
pathlib.Path("canvas.json").write_text(json.dumps(canvas, indent=2))
print("all 8 artboards + canvas.json written")
