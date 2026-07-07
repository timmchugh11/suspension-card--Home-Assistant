/* suspension-card — air-suspension Lovelace card.
   Side/back van images tilt to show pitch & roll; airbag pressure gauges;
   preset tabs; manual inflate/deflate. No external deps. */

// The build step (build.mjs) replaces the empty strings below with base64 data
// URIs of the van images, producing a single self-contained file. When empty
// (dev), the images are loaded from ./img/ next to this module instead.
const VAN_SIDE_B64 = "";
const VAN_BACK_B64 = "";
const VAN_SIDE_SRC = VAN_SIDE_B64 || new URL("./img/van_side.png", import.meta.url).toString();
const VAN_BACK_SRC = VAN_BACK_B64 || new URL("./img/van_back.png", import.meta.url).toString();

// Visual amplification of the image tilt (real angles are small). The numeric
// readouts always show the true angle; only the image rotation is scaled.
const ROT_SCALE = 2;

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
const DEFAULT_CONFIG = {
  entity_pitch: "",
  entity_roll: "",
  pitch_zero: 0,
  roll_zero: 0,
  invert_pitch: false,
  invert_roll: false,
  invert_pitch_image: false,
  invert_roll_image: false,
  tilt_multiplier: 1,
  decimals: 1,
  entity_pressure_left: "",
  entity_pressure_right: "",
  pressure_max_psi: 100,
  pressure_decimals: 1,
  entity_drive_preset: "",
  entity_level_preset: "",
  entity_inflate_left: "",
  entity_deflate_left: "",
  entity_inflate_right: "",
  entity_deflate_right: "",
  button_mode: "hold", // "hold" | "toggle"
};

function normalizeConfig(config) {
  const c = config || {};
  return {
    ...DEFAULT_CONFIG,
    ...c,
    // tilt entities + legacy aliases
    entity_pitch: c.entity_pitch ?? c.entity_front_to_back ?? c.entity_y ?? "",
    entity_roll: c.entity_roll ?? c.entity_side_to_side ?? c.entity_x ?? "",
    pitch_zero: Number(c.pitch_zero ?? c.front_to_back_zero ?? c.y_offset ?? 0) || 0,
    roll_zero: Number(c.roll_zero ?? c.side_to_side_zero ?? c.x_offset ?? 0) || 0,
    invert_pitch: Boolean(c.invert_pitch ?? c.invert_front_to_back ?? c.invert_y ?? false),
    invert_roll: Boolean(c.invert_roll ?? c.invert_side_to_side ?? c.invert_x ?? false),
    invert_pitch_image: Boolean(c.invert_pitch_image ?? false),
    invert_roll_image: Boolean(c.invert_roll_image ?? false),
    tilt_multiplier: Number(c.tilt_multiplier ?? c.multiplier ?? 1) || 1,
    decimals: Math.max(0, Number(c.decimals ?? 1) || 0),
    pressure_max_psi: Number(c.pressure_max_psi ?? 100) || 100,
    pressure_decimals: Math.max(0, Number(c.pressure_decimals ?? 1) || 0),
    button_mode: c.button_mode === "toggle" ? "toggle" : "hold",
  };
}

const CARD_STYLE = `
  :host { display: block; }
  ha-card {
    --ha-card-border-width: 0;
    --ha-card-background: transparent;
    --ha-card-box-shadow: none;
    border: none; background: transparent; box-shadow: none; overflow: visible;
  }
  .level-card {
    position: relative;
    container-type: inline-size;
    overflow: hidden;
    border-radius: var(--ha-card-border-radius, 12px);
    background:
      radial-gradient(circle at 50% 40%, rgba(255,255,255,0.05), transparent 38%),
      linear-gradient(145deg, #1c1c1c, #121212);
    border: 1px solid rgba(255,255,255,0.12);
    color: #f2f2f2;
    font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
    padding: 18px;
  }
  .top-tabs { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
  .tab {
    flex: 1; max-width: 260px; min-height: 52px; border-radius: 15px;
    border: 1px solid rgba(255,255,255,0.12);
    background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
    color: #e8e8e8; display: flex; align-items: center; justify-content: center; gap: 10px;
    font-size: 16px; font-weight: 650; cursor: pointer; user-select: none;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); transition: all .15s ease;
  }
  .tab svg { width: 22px; height: 22px; opacity: .75; }
  .tab.active {
    color: #ffc400; border-color: rgba(255,196,0,.42);
    background: linear-gradient(180deg, rgba(255,196,0,.22), rgba(255,196,0,.09));
    box-shadow: 0 0 22px rgba(255,196,0,.08), inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .main-layout { display: grid; grid-template-columns: minmax(116px, 150px) minmax(0, 1fr) minmax(116px, 150px); gap: 16px; align-items: stretch; }

  /* Airbag pressure: full-height vertical progress bar with the psi centred. */
  .air-card {
    border: 1px solid rgba(255,255,255,0.12); border-radius: 20px;
    background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
    padding: 16px 12px; display: flex; flex-direction: column; gap: 12px; min-width: 0;
  }
  .air-title { font-size: 14px; font-weight: 720; letter-spacing: 0.09em; text-align: center; }
  .gauge {
    position: relative; flex: 1; min-height: 150px; width: 100%;
    border: 1px solid rgba(255,255,255,0.16); border-radius: 16px; overflow: hidden;
    background: rgba(0,0,0,0.28); box-shadow: inset 0 0 22px rgba(0,0,0,0.4);
    display: grid; place-items: center;
  }
  .gauge-fill {
    position: absolute; left: 0; right: 0; bottom: 0; height: 0%;
    background: linear-gradient(180deg, rgba(52,169,255,0.30), rgba(52,169,255,0.68));
    border-top: 2px solid #7cd0ff; box-shadow: 0 -2px 26px rgba(52,169,255,0.45);
    transition: height .5s cubic-bezier(.4,0,.2,1);
  }
  .gauge-value { position: relative; z-index: 1; text-align: center; text-shadow: 0 2px 10px rgba(0,0,0,0.75); }
  .gauge-psi { font-size: 32px; font-weight: 400; letter-spacing: -0.03em; line-height: 1; }
  .gauge-psi span { font-size: 15px; margin-left: 3px; color: #dfefff; }
  .manual-buttons { width: 100%; display: grid; gap: 10px; }
  .small-btn {
    border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.025); color: #efefef;
    height: 46px; border-radius: 13px; display: flex; align-items: center; justify-content: center; gap: 12px;
    font-size: 15px; cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none;
    transition: background .12s ease, border-color .12s ease;
  }
  .small-btn:active, .small-btn.active { background: rgba(52,169,255,0.16); border-color: rgba(52,169,255,0.5); }
  .small-btn .chev { width: 18px; height: 18px; color: #34a9ff; flex: 0 0 auto; }

  /* Centre: pitch (top) and roll (bottom) stacked, filling the same height as
     the side gauges; each shows the van image tilting to the live angle. */
  .center { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .tilt-panel {
    position: relative; flex: 1; min-height: 120px;
    border: 1px solid rgba(255,255,255,0.10); border-radius: 18px;
    background: rgba(0,0,0,0.14);
    display: grid; grid-template-columns: minmax(74px, auto) 1fr; align-items: center; gap: 12px;
    padding: 12px 18px; overflow: hidden;
  }
  .tilt-head { min-width: 0; }
  .tilt-label { font-size: 12px; letter-spacing: .08em; color: #aaa; margin-bottom: 4px; }
  .tilt-value { font-size: 32px; font-weight: 330; letter-spacing: -0.05em; line-height: 1; cursor: pointer; }
  .tilt-dir { color: #888; font-size: 12px; margin-top: 6px; white-space: nowrap; }
  .tilt-stage { position: relative; height: 100%; display: grid; place-items: center; min-width: 0; }
  .tilt-img {
    max-width: 86%; max-height: 128px; object-fit: contain;
    filter: drop-shadow(0 8px 12px rgba(0,0,0,0.45));
    transform-origin: 50% 78%;
    transition: transform .5s cubic-bezier(.34,1.2,.5,1);
  }
  .tilt-ground {
    position: absolute; left: 8%; right: 8%; bottom: 14%; height: 1px;
    background: rgba(255,255,255,0.12);
  }

  /* Scale down as the card's own width shrinks (container queries). */
  @container (max-width: 720px) {
    .level-card { padding: 14px; }
    .top-tabs { gap: 8px; margin-bottom: 12px; }
    .tab { min-height: 44px; font-size: 14px; gap: 7px; border-radius: 13px; }
    .tab svg { width: 18px; height: 18px; }
    .main-layout { gap: 10px; grid-template-columns: minmax(96px, 122px) minmax(0, 1fr) minmax(96px, 122px); }
    .air-card { padding: 12px 8px; border-radius: 16px; gap: 10px; }
    .air-title { font-size: 12px; }
    .gauge { min-height: 120px; border-radius: 14px; }
    .gauge-psi { font-size: 24px; }
    .gauge-psi span { font-size: 12px; }
    .manual-buttons { gap: 8px; }
    .small-btn { height: 40px; font-size: 13px; border-radius: 11px; gap: 7px; }
    .small-btn .chev { width: 16px; height: 16px; }
    .center { gap: 10px; }
    .tilt-panel { padding: 10px 12px; gap: 8px; grid-template-columns: minmax(58px, auto) 1fr; border-radius: 14px; }
    .tilt-label { font-size: 11px; margin-bottom: 2px; }
    .tilt-value { font-size: 24px; }
    .tilt-dir { font-size: 10px; margin-top: 3px; }
    .tilt-img { max-height: 104px; }
  }
  @container (max-width: 500px) {
    .level-card { padding: 11px; }
    .tab { min-height: 40px; font-size: 12px; }
    .tab svg { width: 16px; height: 16px; }
    .main-layout { gap: 7px; grid-template-columns: minmax(82px, 104px) minmax(0, 1fr) minmax(82px, 104px); }
    .air-card { padding: 10px 6px; gap: 8px; }
    .air-title { font-size: 11px; letter-spacing: .05em; }
    .gauge { min-height: 96px; border-radius: 12px; }
    .gauge-psi { font-size: 20px; }
    .gauge-psi span { font-size: 10px; }
    .small-btn { height: 34px; font-size: 12px; gap: 6px; }
    .small-btn .chev { width: 14px; height: 14px; }
    .tilt-panel { padding: 8px 10px; grid-template-columns: minmax(48px, auto) 1fr; }
    .tilt-label { font-size: 9px; }
    .tilt-value { font-size: 19px; }
    .tilt-dir { font-size: 9px; }
    .tilt-img { max-height: 86px; }
  }
`;

const ICON_DRIVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 14v7M10.2 10.8 4.7 7.5M13.8 10.8l5.5-3.3"/></svg>`;
const ICON_LEVEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1"/></svg>`;
const CHEV_UP = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>`;
const CHEV_DOWN = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */
class SuspensionCard extends HTMLElement {
  static getConfigElement() { return document.createElement("suspension-card-editor"); }
  static getStubConfig() {
    return {
      type: "custom:suspension-card",
      entity_pitch: "",
      entity_roll: "",
      entity_pressure_left: "",
      entity_pressure_right: "",
      entity_drive_preset: "",
      entity_level_preset: "",
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
  }

  getCardSize() { return 6; }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  disconnectedCallback() { this._built = false; }

  _build() {
    const root = document.createElement("ha-card");
    root.innerHTML = `
      <style>${CARD_STYLE}</style>
      <div class="level-card">
        <nav class="top-tabs">
          <div class="tab" data-preset="drive">${ICON_DRIVE}<span>Driving Preset</span></div>
          <div class="tab" data-preset="level">${ICON_LEVEL}<span>Auto Level</span></div>
        </nav>
        <section class="main-layout">
          <aside class="air-card">
            <div class="air-title">REAR LEFT</div>
            <div class="gauge">
              <div class="gauge-fill" data-fill="left"></div>
              <div class="gauge-value"><div class="gauge-psi" data-psi="left">—<span>psi</span></div></div>
            </div>
            <div class="manual-buttons">
              <div class="small-btn" data-btn="inflate_left">${CHEV_UP}Inflate</div>
              <div class="small-btn" data-btn="deflate_left">${CHEV_DOWN}Deflate</div>
            </div>
          </aside>

          <main class="center">
            <div class="tilt-panel">
              <div class="tilt-head">
                <div class="tilt-label">PITCH</div>
                <div class="tilt-value" data-angle="pitch">0.0°</div>
                <div class="tilt-dir" data-dir="pitch"></div>
              </div>
              <div class="tilt-stage">
                <div class="tilt-ground"></div>
                <img class="tilt-img" data-img="pitch" src="${VAN_SIDE_SRC}" alt="van side" draggable="false">
              </div>
            </div>
            <div class="tilt-panel">
              <div class="tilt-head">
                <div class="tilt-label">ROLL</div>
                <div class="tilt-value" data-angle="roll">0.0°</div>
                <div class="tilt-dir" data-dir="roll"></div>
              </div>
              <div class="tilt-stage">
                <div class="tilt-ground"></div>
                <img class="tilt-img" data-img="roll" src="${VAN_BACK_SRC}" alt="van rear" draggable="false">
              </div>
            </div>
          </main>

          <aside class="air-card">
            <div class="air-title">REAR RIGHT</div>
            <div class="gauge">
              <div class="gauge-fill" data-fill="right"></div>
              <div class="gauge-value"><div class="gauge-psi" data-psi="right">—<span>psi</span></div></div>
            </div>
            <div class="manual-buttons">
              <div class="small-btn" data-btn="inflate_right">${CHEV_UP}Inflate</div>
              <div class="small-btn" data-btn="deflate_right">${CHEV_DOWN}Deflate</div>
            </div>
          </aside>
        </section>
      </div>
    `;
    this.shadowRoot.innerHTML = "";
    this.shadowRoot.appendChild(root);

    this._el = {
      tabs: root.querySelectorAll(".tab"),
      fill: { left: root.querySelector('[data-fill="left"]'), right: root.querySelector('[data-fill="right"]') },
      psi: { left: root.querySelector('[data-psi="left"]'), right: root.querySelector('[data-psi="right"]') },
      angle: { pitch: root.querySelector('[data-angle="pitch"]'), roll: root.querySelector('[data-angle="roll"]') },
      dir: { pitch: root.querySelector('[data-dir="pitch"]'), roll: root.querySelector('[data-dir="roll"]') },
      img: { pitch: root.querySelector('[data-img="pitch"]'), roll: root.querySelector('[data-img="roll"]') },
      btns: {
        deflate_left: root.querySelector('[data-btn="deflate_left"]'),
        inflate_left: root.querySelector('[data-btn="inflate_left"]'),
        deflate_right: root.querySelector('[data-btn="deflate_right"]'),
        inflate_right: root.querySelector('[data-btn="inflate_right"]'),
      },
    };

    root.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => this._onPreset(tab.dataset.preset));
    });
    this._el.angle.pitch.addEventListener("click", () => this._moreInfo(this.config.entity_pitch));
    this._el.angle.roll.addEventListener("click", () => this._moreInfo(this.config.entity_roll));

    this._wireButton("inflate_left", "entity_inflate_left");
    this._wireButton("deflate_left", "entity_deflate_left");
    this._wireButton("inflate_right", "entity_inflate_right");
    this._wireButton("deflate_right", "entity_deflate_right");

    this._built = true;
  }

  _wireButton(key, cfgKey) {
    const el = this._el.btns[key];
    const getEntity = () => this.config[cfgKey];
    if (this.config.button_mode === "toggle") {
      el.addEventListener("click", () => {
        const ent = getEntity();
        if (ent) this._svc(ent, "toggle");
      });
    } else {
      const down = (ev) => {
        ev.preventDefault();
        const ent = getEntity();
        if (ent) this._svc(ent, "turn_on");
      };
      const up = () => {
        const ent = getEntity();
        if (ent) this._svc(ent, "turn_off");
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("pointercancel", up);
    }
  }

  _svc(entityId, service) {
    const domain = entityId.split(".")[0];
    this._hass?.callService(domain, service, { entity_id: entityId });
  }

  _onPreset(which) {
    const target = which === "drive" ? this.config.entity_drive_preset : this.config.entity_level_preset;
    const other = which === "drive" ? this.config.entity_level_preset : this.config.entity_drive_preset;
    if (other) this._hass?.callService("input_boolean", "turn_off", { entity_id: other });
    if (target) this._hass?.callService("input_boolean", "toggle", { entity_id: target });
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }

  _stateNum(entityId) {
    const s = this._hass?.states?.[entityId];
    if (!s) return null;
    const v = parseFloat(s.state);
    return Number.isFinite(v) ? v : null;
  }

  _update() {
    if (!this._built || !this._hass) return;
    const cfg = this.config;

    // ---- tilt ----
    const rawPitch = this._stateNum(cfg.entity_pitch) ?? 0;
    const rawRoll = this._stateNum(cfg.entity_roll) ?? 0;
    const pitch = (rawPitch * (cfg.invert_pitch ? -1 : 1)) + cfg.pitch_zero;
    const roll = (rawRoll * (cfg.invert_roll ? -1 : 1)) + cfg.roll_zero;

    this._el.angle.pitch.textContent = `${pitch.toFixed(cfg.decimals)}°`;
    this._el.angle.roll.textContent = `${roll.toFixed(cfg.decimals)}°`;
    this._el.dir.pitch.textContent = this._pitchDir(pitch);
    this._el.dir.roll.textContent = this._rollDir(roll);

    // Rotate the van images to match the direction labels. Side view has the
    // front on the left, so "front down" (pitch < 0) tips clockwise; the rear
    // view mirrors left/right, so both are negated relative to the raw angle.
    // invert_*_image flips only the image lean, not the numeric readout.
    const scale = ROT_SCALE * (Number(cfg.tilt_multiplier) || 1);
    const pImg = cfg.invert_pitch_image ? -1 : 1;
    const rImg = cfg.invert_roll_image ? -1 : 1;
    this._el.img.pitch.style.transform = `rotate(${(-pitch * scale * pImg).toFixed(2)}deg)`;
    this._el.img.roll.style.transform = `rotate(${(-roll * scale * rImg).toFixed(2)}deg)`;

    // ---- pressures ----
    this._updatePressure("left", cfg.entity_pressure_left);
    this._updatePressure("right", cfg.entity_pressure_right);

    // ---- presets ----
    this._setTabActive("drive", cfg.entity_drive_preset);
    this._setTabActive("level", cfg.entity_level_preset);

    // ---- manual valve buttons: highlight while their relay is on ----
    this._setBtnActive("inflate_left", cfg.entity_inflate_left);
    this._setBtnActive("deflate_left", cfg.entity_deflate_left);
    this._setBtnActive("inflate_right", cfg.entity_inflate_right);
    this._setBtnActive("deflate_right", cfg.entity_deflate_right);
  }

  _setBtnActive(key, entityId) {
    const btn = this._el.btns[key];
    if (!btn) return;
    const on = entityId && this._hass?.states?.[entityId]?.state === "on";
    btn.classList.toggle("active", Boolean(on));
  }

  _updatePressure(side, entityId) {
    const cfg = this.config;
    const v = this._stateNum(entityId);
    if (v === null) {
      this._el.psi[side].innerHTML = `—<span>psi</span>`;
      this._el.fill[side].style.height = "0%";
      return;
    }
    this._el.psi[side].innerHTML = `${v.toFixed(cfg.pressure_decimals)}<span>psi</span>`;
    const pct = Math.max(0, Math.min(100, (v / cfg.pressure_max_psi) * 100));
    this._el.fill[side].style.height = `${pct}%`;
  }

  _setTabActive(which, entityId) {
    const tab = Array.from(this._el.tabs).find((t) => t.dataset.preset === which);
    if (!tab) return;
    const on = entityId && this._hass?.states?.[entityId]?.state === "on";
    tab.classList.toggle("active", Boolean(on));
  }

  _pitchDir(v) {
    const t = 0.15;
    if (v > t) return "Front Up";
    if (v < -t) return "Front Down";
    return "Level";
  }
  _rollDir(v) {
    const t = 0.15;
    if (v > t) return "Right Down";
    if (v < -t) return "Left Down";
    return "Level";
  }
}

customElements.define("suspension-card", SuspensionCard);

/* ------------------------------------------------------------------ *
 * Visual editor
 * ------------------------------------------------------------------ */
class SuspensionCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULT_CONFIG };
    this._hass = null;
    this._sig = "";
  }

  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, type: "custom:suspension-card", ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const sig = this._entitySignature();
    if (!this.shadowRoot.innerHTML || sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  _entitiesByDomain(domain) {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter((e) => e.startsWith(domain + "."))
      .sort((a, b) => a.localeCompare(b));
  }

  _entitySignature() {
    if (!this._hass) return "";
    return JSON.stringify({
      s: this._entitiesByDomain("sensor").length,
      b: this._entitiesByDomain("input_boolean").length,
      w: this._entitiesByDomain("switch").length,
    });
  }

  _emit(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
  }

  _options(selected, entities, placeholder) {
    const out = [`<option value="">${placeholder}</option>`];
    entities.forEach((e) => out.push(`<option value="${e}"${e === selected ? " selected" : ""}>${e}</option>`));
    return out.join("");
  }

  _select(key, label, domain, placeholder) {
    const sel = this._config[key] || "";
    return `
      <div class="field">
        <label for="f-${key}">${label}</label>
        <select id="f-${key}" data-key="${key}">${this._options(sel, this._entitiesByDomain(domain), placeholder)}</select>
      </div>`;
  }

  _number(key, label, step = "0.1") {
    return `
      <div class="field">
        <label for="f-${key}">${label}</label>
        <input id="f-${key}" data-key="${key}" data-type="number" type="number" step="${step}" value="${Number(this._config[key] ?? 0)}">
      </div>`;
  }

  _toggle(key, label) {
    return `
      <label class="toggle">
        <input id="f-${key}" data-key="${key}" data-type="bool" type="checkbox"${this._config[key] ? " checked" : ""}>
        <span>${label}</span>
      </label>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        .editor { display: grid; gap: 12px; padding: 12px 0; }
        .field { display: grid; gap: 6px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .section-title { font-size: 15px; font-weight: 700; margin-top: 10px; border-top: 1px solid var(--divider-color, #444); padding-top: 12px; }
        label { font-size: 13px; font-weight: 600; }
        select, input[type="number"] { padding: 8px; font: inherit; width: 100%; box-sizing: border-box; }
        .toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      </style>
      <div class="editor">
        <div class="section-title">Tilt sensors</div>
        ${this._select("entity_pitch", "Pitch sensor (front ↔ back)", "sensor", "Select sensor")}
        ${this._select("entity_roll", "Roll sensor (side ↔ side)", "sensor", "Select sensor")}
        <div class="row">
          ${this._number("pitch_zero", "Pitch zero offset")}
          ${this._number("roll_zero", "Roll zero offset")}
        </div>
        <div class="row">
          ${this._number("tilt_multiplier", "Visual tilt multiplier")}
          ${this._number("decimals", "Angle decimals", "1")}
        </div>
        ${this._toggle("invert_pitch", "Invert pitch (value + image)")}
        ${this._toggle("invert_roll", "Invert roll (value + image)")}
        ${this._toggle("invert_pitch_image", "Invert pitch image lean only")}
        ${this._toggle("invert_roll_image", "Invert roll image lean only")}

        <div class="section-title">Airbag pressure</div>
        ${this._select("entity_pressure_left", "Rear-left pressure", "sensor", "Select sensor")}
        ${this._select("entity_pressure_right", "Rear-right pressure", "sensor", "Select sensor")}
        <div class="row">
          ${this._number("pressure_max_psi", "Max pressure (psi) = full bar", "1")}
          ${this._number("pressure_decimals", "Pressure decimals", "1")}
        </div>

        <div class="section-title">Presets</div>
        ${this._select("entity_drive_preset", "Driving Preset (input_boolean)", "input_boolean", "Select input boolean")}
        ${this._select("entity_level_preset", "Auto Level (input_boolean)", "input_boolean", "Select input boolean")}

        <div class="section-title">Manual air controls</div>
        ${this._select("entity_inflate_left", "Rear-left Inflate", "switch", "Select switch")}
        ${this._select("entity_deflate_left", "Rear-left Deflate", "switch", "Select switch")}
        ${this._select("entity_inflate_right", "Rear-right Inflate", "switch", "Select switch")}
        ${this._select("entity_deflate_right", "Rear-right Deflate", "switch", "Select switch")}
        <div class="field">
          <label for="f-button_mode">Button behaviour</label>
          <select id="f-button_mode" data-key="button_mode">
            <option value="hold"${this._config.button_mode !== "toggle" ? " selected" : ""}>Hold to run (momentary)</option>
            <option value="toggle"${this._config.button_mode === "toggle" ? " selected" : ""}>Tap to toggle</option>
          </select>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-key]").forEach((el) => {
      const key = el.dataset.key;
      const type = el.dataset.type;
      el.addEventListener("change", (e) => {
        const t = e.target;
        let val;
        if (type === "bool") val = t.checked;
        else if (type === "number") val = Number(t.value);
        else val = t.value;
        this._emit(key, val);
      });
    });
  }
}

customElements.define("suspension-card-editor", SuspensionCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "suspension-card",
  name: "Suspension Card",
  description: "Van tilt (pitch & roll), airbag pressures, presets and manual inflate/deflate for air suspension.",
  preview: false,
  documentationURL: "https://github.com/timmchugh11/suspension-card--Home-Assistant",
});

console.info("%c SUSPENSION-CARD %c v0.2.0 ", "color:#fff;background:#34a9ff;border-radius:3px 0 0 3px;padding:2px 4px", "color:#34a9ff;background:#222;border-radius:0 3px 3px 0;padding:2px 4px");
