import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  DEFAULT_FRENZY_CONFIG,
  FrenzyConfig,
} from "../../core/game/frenzy/FrenzyTypes";
import { GameFork, GameType } from "../../core/game/Game";
import { JoinLobbyEvent } from "../types/JoinLobbyEvent";
import { FRENZY_CONFIG_EVENT, FRENZY_RESTART_EVENT } from "./FrenzyDevChannels";

interface ConfigField {
  key: keyof FrenzyConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  description?: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: "spawnInterval",
    label: "Spawn Interval (s)",
    min: 0.25,
    max: 10,
    step: 0.05,
    description: "Lower values spawn units faster",
  },
  {
    key: "maxUnitsPerPlayer",
    label: "Max Units",
    min: 5,
    max: 300,
    step: 1,
  },
  {
    key: "startingUnits",
    label: "Starting Units",
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "unitHealth",
    label: "Unit HP",
    min: 10,
    max: 1000,
    step: 5,
  },
  {
    key: "unitSpeed",
    label: "Unit Speed (px/s)",
    min: 5,
    max: 200,
    step: 1,
  },
  {
    key: "unitDPS",
    label: "Unit DPS",
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "combatRange",
    label: "Combat Range (px)",
    min: 5,
    max: 120,
    step: 1,
  },
  {
    key: "separationRadius",
    label: "Separation Radius (px)",
    min: 1,
    max: 80,
    step: 1,
  },
  {
    key: "captureRadius",
    label: "Capture Radius (tiles)",
    min: 1,
    max: 12,
    step: 1,
    description: "How far around a unit tiles can flip",
  },
  {
    key: "radialAlignmentWeight",
    label: "Radial Bias",
    min: 0,
    max: 2,
    step: 0.05,
    description: "Higher = stronger push along centroid rays",
  },
  {
    key: "borderAdvanceDistance",
    label: "Border Advance (px)",
    min: 0,
    max: 80,
    step: 1,
    description: "How far past the frontier units aim",
  },
  {
    key: "stopDistance",
    label: "Stop Distance (px)",
    min: 0,
    max: 30,
    step: 0.5,
    description: "How close units travel to their target",
  },
];

const DEV_PANEL_ENABLED = shouldEnableDevPanel();

@customElement("frenzy-dev-panel")
export class FrenzyDevPanel extends LitElement {
  @state() private isCollapsed = false;
  @state() private config: FrenzyConfig = { ...DEFAULT_FRENZY_CONFIG };
  @state() private lastAppliedAt: number | null = null;
  @state() private canRestart = false;

  private readonly handleJoinLobby = (event: Event) => {
    if (!DEV_PANEL_ENABLED) return;
    const detail = (event as CustomEvent<JoinLobbyEvent>).detail;
    const info = detail?.gameStartInfo;
    if (!info) {
      this.canRestart = false;
      return;
    }
    this.canRestart =
      info.config.gameFork === GameFork.Frenzy &&
      info.config.gameType === GameType.Singleplayer;
  };

  connectedCallback() {
    super.connectedCallback();
    if (!DEV_PANEL_ENABLED) {
      this.style.display = "none";
      return;
    }
    document.addEventListener("join-lobby", this.handleJoinLobby);
  }

  disconnectedCallback() {
    document.removeEventListener("join-lobby", this.handleJoinLobby);
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 9999;
      font-family:
        "Inter",
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .panel {
      width: 320px;
      background: rgba(15, 23, 42, 0.9);
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.4);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(12px);
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: rgba(51, 65, 85, 0.9);
      border-bottom: 1px solid rgba(148, 163, 184, 0.4);
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    header button {
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .body {
      max-height: 540px;
      overflow-y: auto;
      padding: 0.75rem 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
    }

    .field label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #cbd5f5;
    }

    .field input[type="range"] {
      width: 100%;
    }

    .field input[type="number"] {
      width: 100%;
      padding: 0.25rem 0.4rem;
      border-radius: 6px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(15, 23, 42, 0.8);
      color: inherit;
      font-size: 0.85rem;
    }

    .description {
      font-size: 0.7rem;
      color: #94a3b8;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .actions button {
      flex: 1;
      min-width: 90px;
      border: none;
      border-radius: 6px;
      padding: 0.45rem 0.5rem;
      font-size: 0.8rem;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .apply {
      background: #0ea5e9;
      color: #0f172a;
    }

    .reset {
      background: rgba(148, 163, 184, 0.2);
      color: #e2e8f0;
    }

    .restart {
      background: #f97316;
      color: #0f172a;
    }

    .restart[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .status {
      font-size: 0.7rem;
      color: #a5f3fc;
      text-align: right;
    }
  `;

  render() {
    if (!DEV_PANEL_ENABLED) {
      return html``;
    }

    return html`
      <div class="panel">
        <header>
          <span>Frenzy Dev Panel</span>
          <button @click=${this.toggleCollapse}>
            ${this.isCollapsed ? "Expand" : "Collapse"}
          </button>
        </header>
        ${this.isCollapsed
          ? html``
          : html`
              <div class="body">
                ${CONFIG_FIELDS.map((field) => this.renderField(field))}
                <div class="actions">
                  <button class="apply" @click=${this.applyConfig}>
                    Apply
                  </button>
                  <button class="reset" @click=${this.resetDefaults}>
                    Reset
                  </button>
                  <button
                    class="restart"
                    ?disabled=${!this.canRestart}
                    @click=${this.requestRestart}
                  >
                    Restart
                  </button>
                </div>
                ${this.lastAppliedAt
                  ? html`<div class="status">
                      Applied ${timeSince(this.lastAppliedAt)} ago
                    </div>`
                  : html``}
              </div>
            `}
      </div>
    `;
  }

  private renderField(field: ConfigField) {
    const value = this.config[field.key];
    return html`
      <div class="field">
        <label>
          ${field.label}
          <span>
            ${Number(value).toFixed(
              field.step < 1
                ? Math.max(1, `${field.step}`.split(".")[1].length)
                : 0,
            )}
          </span>
        </label>
        <input
          type="range"
          min=${field.min}
          max=${field.max}
          step=${field.step}
          .value=${String(value)}
          @input=${(event: Event) => this.handleRangeChange(field, event)}
        />
        <input
          type="number"
          min=${field.min}
          max=${field.max}
          step=${field.step}
          .value=${String(value)}
          @change=${(event: Event) => this.handleNumberChange(field, event)}
        />
        ${field.description
          ? html`<div class="description">${field.description}</div>`
          : html``}
      </div>
    `;
  }

  private handleRangeChange(field: ConfigField, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.updateConfigField(field.key, value);
  }

  private handleNumberChange(field: ConfigField, event: Event) {
    const input = event.target as HTMLInputElement;
    const rawValue = Number(input.value);
    const clamped = clamp(rawValue, field.min, field.max);
    input.value = String(clamped);
    this.updateConfigField(field.key, clamped);
  }

  private updateConfigField(key: keyof FrenzyConfig, value: number) {
    this.config = {
      ...this.config,
      [key]: value,
    };
  }

  private applyConfig() {
    document.dispatchEvent(
      new CustomEvent(FRENZY_CONFIG_EVENT, {
        bubbles: true,
        composed: true,
        detail: { ...this.config },
      }),
    );
    this.lastAppliedAt = Date.now();
  }

  private resetDefaults() {
    this.config = { ...DEFAULT_FRENZY_CONFIG };
  }

  private requestRestart() {
    if (!this.canRestart) {
      return;
    }
    document.dispatchEvent(
      new CustomEvent(FRENZY_RESTART_EVENT, {
        bubbles: true,
        composed: true,
        detail: {
          source: "frenzy-dev-panel",
        },
      }),
    );
  }

  private toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function timeSince(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function shouldEnableDevPanel(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  if (["localhost", "127.0.0.1", "0.0.0.0"].includes(host)) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has("frenzyDev")) {
    return true;
  }
  try {
    return localStorage.getItem("frenzy-dev-panel") === "true";
  } catch (error) {
    console.warn("Unable to read frenzy dev panel flag", error);
    return false;
  }
}
