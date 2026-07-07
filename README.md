# Suspension Card

A Home Assistant Lovelace custom card for air suspension. Side and rear van images **tilt to show pitch and roll** from your angle sensors, alongside **airbag pressure** gauges for the rear-left and rear-right bags, **preset tabs** (Driving / Auto Level), and **manual inflate/deflate** controls.

Everything — sensors, presets, air valves and the pressure scale — is configured from the built-in **visual editor**, so no entity is hard-coded.

![Suspension Card](img/preview.png)

## Install

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories**.
2. Add this repository, category **Dashboard**.
3. Install **Suspension Card**.
4. HACS adds the resource automatically. If not, add it manually (below).

### Manual

1. Copy the whole folder into your Home Assistant `config/www/` directory, e.g. `config/www/suspension-card/`.
2. Add the resource (Settings → Dashboards → ⋮ → Resources):

   ```yaml
   url: /local/suspension-card/suspension-card.js
   type: module
   ```

The shipped `suspension-card.js` is **self-contained** — the van images are embedded inside it — so a normal HACS install (which only downloads the one entry file) works with no companion files and no internet at runtime.

## Adding the card

Add a card, search for **Suspension Card**, and use the visual editor — or paste YAML:

```yaml
type: custom:suspension-card

# Tilt
entity_pitch: sensor.x_angle_2          # front ↔ back
entity_roll: sensor.y_angle_2           # side ↔ side
pitch_zero: 0
roll_zero: 0
invert_pitch: false                     # flip if the side van tips the wrong way
invert_roll: false                      # flip if the rear van tips the wrong way
tilt_multiplier: 1                      # exaggerate the visible tilt only
decimals: 1

# Airbag pressure (raw psi)
entity_pressure_left: sensor.suspension_pressure_rear_left_airbag_pressure
entity_pressure_right: sensor.suspension_pressure_rear_right_airbag_pressure
pressure_max_psi: 100                   # value that fills the bar to 100%
pressure_decimals: 1

# Presets
entity_drive_preset: input_boolean.drive_preset
entity_level_preset: input_boolean.level_preset

# Manual air controls (assign each to whatever switch drives that valve)
entity_inflate_left: switch.power_board_relay_2
entity_deflate_left: switch.power_board_relay_3
entity_inflate_right: switch.power_board_relay_4
entity_deflate_right: switch.power_board_relay_5
button_mode: hold                       # "hold" (momentary) or "toggle"
```

## Options

| Option | Default | Description |
|---|---|---|
| `entity_pitch` / `entity_roll` | — | Angle sensors (degrees). Pitch = front↔back, roll = side↔side. |
| `pitch_zero` / `roll_zero` | `0` | Offset added after inversion to calibrate level. |
| `invert_pitch` / `invert_roll` | `false` | Flip the sign of a sensor — changes both the readout **and** the van image lean. |
| `invert_pitch_image` / `invert_roll_image` | `false` | Flip only the van image lean, leaving the numeric readout unchanged. |
| `tilt_multiplier` | `1` | Multiplies only the **visible** image tilt, not the readouts. |
| `decimals` | `1` | Decimal places for angle readouts. |
| `entity_pressure_left` / `entity_pressure_right` | — | Airbag pressure sensors (psi). |
| `pressure_max_psi` | `100` | Pressure that fills a bar to 100%. |
| `pressure_decimals` | `1` | Decimal places for the psi readout. |
| `entity_drive_preset` / `entity_level_preset` | — | `input_boolean` presets; the two tabs are mutually exclusive. |
| `entity_inflate_left` … `entity_deflate_right` | — | Switches for each manual valve. |
| `button_mode` | `hold` | `hold` = valve open while pressed; `toggle` = tap on/off. |

### Notes

- **Button behaviour.** `hold` mode opens the valve on press and closes it on release (best for momentary solenoids). `toggle` mode flips the switch on each tap.
- **Pump.** The card only drives the valve switches; if your pump follows the valves via an automation, it keeps working unchanged.
- **Tilt calibration.** Set the van level, then adjust `pitch_zero` / `roll_zero` so both read `0.0°`. Use `invert_pitch` / `invert_roll` if the sensor sign is backwards (flips the number and image together), or `invert_pitch_image` / `invert_roll_image` to flip just the image lean when the number is already correct but the van tips the wrong way.
- **Legacy config.** YAML from the older `van-tilt-card` is accepted (`entity_side_to_side`, `entity_front_to_back`, `x_offset`, `multiplier`, etc.).

## Development

The card is authored in `src/suspension-card.js`. The root `suspension-card.js` is a **generated, self-contained build** — do not edit it by hand.

To rebuild after changing the source (or swapping the van images in `img/`):

```bash
node build.mjs      # or: npm run build
```

`build.mjs` embeds `img/van_side.png` and `img/van_back.png` as base64 data URIs into a single `suspension-card.js`. That single file is what HACS ships.
