import { useEffect, useMemo, useState } from "react";
import { api } from "./apiClient";
import "./stateManage.css";

const defaultPayload = `{
  "data": {
    "catalog": {
      "concerts": { "concerts": [] },
      "venues": { "venues": [] },
      "cities": { "cities": [] },
      "seatMaps": {}
    },
    "cart": { "items": [], "selectedSeats": [] },
    "orders": [],
    "preferences": { "currency": "USD" },
    "uploads": []
  },
  "note": "Dev note for this state"
}`;

const COOKIE_NAME = import.meta.env.VITE_COOKIE_NAME || "user_id";
const COOKIE_MAX_AGE = Number(import.meta.env.VITE_COOKIE_MAX_AGE || 60 * 60 * 24 * 30);

// this function checks the URL for a "cookie" query parameter,
// sets the cookie accordingly, and reloads the page without the query parameter
// when build on the basesite, the below function should remain unchanged
const applyCookieFromQuery = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const override = url.searchParams.get("cookie");
  if (!override) return false;
  let cookie = `${COOKIE_NAME}=${encodeURIComponent(override)}; Path=/; SameSite=Lax`;
  if (Number.isFinite(COOKIE_MAX_AGE) && COOKIE_MAX_AGE > 0) {
    cookie += `; Max-Age=${Math.floor(COOKIE_MAX_AGE)}`;
  }
  document.cookie = cookie;
  const redirectUrl = url.origin;
  if (window.location.href !== redirectUrl) {
    window.location.replace(redirectUrl);
    return true;
  }
  return false;
};

const docCards = [
  {
    title: "State shape",
    body: "Every cookie has its own state envelope. You can edit the full envelope or just the data payload.",
  },
  {
    title: "Catalog mirror",
    body: "data.catalog mirrors the JSON payloads under /data so you can inspect concerts, venues, cities, and seat maps.",
  },
  {
    title: "Cart & orders",
    body: "data.cart tracks seat selections + payment snapshot. data.orders stores completed purchases.",
  },
  {
    title: "API shortcuts",
    body: "Use GET/PUT/PATCH/DELETE /api/state to manage state. Query ?cookie=... to switch identity.",
  },
];

function StateManage() {
  const [activeTab, setActiveTab] = useState("editor");
  const [state, setState] = useState(null);
  const [editor, setEditor] = useState(defaultPayload);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const userId = useMemo(() => state?.user_id || "pending", [state]);
  const updatedAt = state?.state?.meta?.updated_at || "not synced yet";

  const handleError = (err) => {
    console.error(err);
    setError(err.message || "Request failed");
  };

  const refreshState = async ({ syncEditor = true } = {}) => {
    setMessage("");
    setError("");
    try {
      setLoading(true);
      const next = await api.getState();
      setState(next);
      setNote(next.state?.note || "");
      if (syncEditor) {
        setEditor(JSON.stringify(next.state || {}, null, 2));
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const redirected = applyCookieFromQuery();
    if (redirected) return;
    refreshState();
  }, []);

  const parseEditor = () => {
    try {
      return JSON.parse(editor);
    } catch (err) {
      throw new Error("Editor content is not valid JSON.");
    }
  };

  const normalizePayload = (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("State must be a JSON object.");
    }
    const hasEnvelope = Object.prototype.hasOwnProperty.call(payload, "data");
    const data = hasEnvelope ? payload.data : payload;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("State must include a data object.");
    }
    const note = Object.prototype.hasOwnProperty.call(payload, "note") ? payload.note : undefined;
    const meta = Object.prototype.hasOwnProperty.call(payload, "meta") ? payload.meta : undefined;
    return { data, note, meta };
  };

  const runReplace = async () => {
    setMessage("");
    setError("");
    try {
      setLoading(true);
      const payload = normalizePayload(parseEditor());
      const next = await api.replaceState(
        payload.data,
        payload.note ?? note,
        payload.meta
      );
      setState(next);
      setEditor(JSON.stringify(next.state || {}, null, 2));
      setNote(next.state?.note || "");
      setMessage("State replaced.");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const runPatch = async () => {
    setMessage("");
    setError("");
    try {
      setLoading(true);
      const payload = normalizePayload(parseEditor());
      const next = await api.patchState(payload.data, payload.note ?? note);
      setState(next);
      setEditor(JSON.stringify(next.state || {}, null, 2));
      setNote(next.state?.note || "");
      setMessage("State patched.");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const runReset = async () => {
    setMessage("");
    setError("");
    try {
      setLoading(true);
      const next = await api.resetState();
      setState(next);
      setEditor(JSON.stringify(next.state || {}, null, 2));
      setNote(next.state?.note || "");
      setMessage("State reset.");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadState = () => {
    setMessage("");
    setError("");
    try {
      const payload = parseEditor();
      const fileNameBase = state?.user_id ? `state-${state.user_id}` : "state";
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileNameBase}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      handleError(err);
    }
  };

  const prettyState = state ? JSON.stringify(state.state, null, 2) : "// no state yet";

  return (
    <div className="state-manage">
      <div className="state-manage__shell">
        <header className="state-manage__header">
          <div className="state-manage__title">
            <h1>State Console</h1>
            <p>Inspect, patch, and reset per-user state while you build new flows.</p>
          </div>
          <div className="state-manage__chips">
            <span className="state-chip">User: {userId}</span>
            <span className="state-chip">API: {api.baseUrl}</span>
            <span className="state-chip">Updated: {updatedAt}</span>
          </div>
          <a className="state-link" href="/">Back to site</a>
        </header>

        <div className="state-tabs">
          <button
            type="button"
            className={`state-tab ${activeTab === "editor" ? "state-tab--active" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            Live editor
          </button>
          <button
            type="button"
            className={`state-tab ${activeTab === "docs" ? "state-tab--active" : ""}`}
            onClick={() => setActiveTab("docs")}
          >
            Docs
          </button>
        </div>

        {activeTab === "editor" ? (
          <div className="state-panels">
            <section className="state-panel">
              <div className="state-panel__header">
                <h2>Edit JSON</h2>
                <span>Use PATCH for partial updates, PUT for full replace.</span>
              </div>
              <div className="state-grid">
                <div className="state-editor">
                  <label className="state-label">
                    Note (optional)
                    <input
                      type="text"
                      placeholder="Describe this change"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <label className="state-label">
                    JSON payload
                    <textarea
                      spellCheck={false}
                      value={editor}
                      onChange={(event) => setEditor(event.target.value)}
                    />
                  </label>
                  <div className="state-actions">
                    <button className="state-btn" type="button" onClick={runPatch} disabled={loading}>
                      PATCH merge
                    </button>
                    <button
                      className="state-btn state-btn--outline"
                      type="button"
                      onClick={runReplace}
                      disabled={loading}
                    >
                      PUT replace
                    </button>
                    <button
                      className="state-btn state-btn--ghost"
                      type="button"
                      onClick={runReset}
                      disabled={loading}
                    >
                      Reset
                    </button>
                    <button
                      className="state-btn state-btn--ghost"
                      type="button"
                      onClick={downloadState}
                      disabled={loading}
                    >
                      Download JSON
                    </button>
                    <button
                      className="state-btn state-btn--ghost"
                      type="button"
                      onClick={() => refreshState({ syncEditor: true })}
                      disabled={loading}
                    >
                      Refresh
                    </button>
                  </div>
                  <div className={`state-message ${error ? "error" : ""}`}>
                    {error || message}
                  </div>
                </div>

                <div>
                  <div className="state-panel__header">
                    <h2>Current state</h2>
                    <span>Live server view</span>
                  </div>
                  <pre className="state-code">{prettyState}</pre>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="state-panels">
            <section className="state-panel">
              <div className="state-panel__header">
                <h2>State reference</h2>
                <span>Quick guide for common fields</span>
              </div>
              <div className="state-docs-grid">
                {docCards.map((card) => (
                  <div className="state-doc" key={card.title}>
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </div>
                ))}
                <div className="state-doc">
                  <h3>Common keys</h3>
                  <ul>
                    <li>data.catalog.concerts / venues / cities / seatMaps</li>
                    <li>data.cart.items / selectedSeats / payment</li>
                    <li>data.orders</li>
                    <li>data.preferences</li>
                    <li>data.uploads</li>
                  </ul>
                  <code>?cookie=dev-user-1</code>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default StateManage;
