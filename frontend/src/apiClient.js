const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.detail || response.statusText || "Request failed";
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  baseUrl: API_BASE,
  getState: () => request("/state"),
  replaceState: (data, note, meta) =>
    request("/state", { method: "PUT", body: JSON.stringify({ data, note, meta }) }),
  patchState: (data, note) => request("/state", { method: "PATCH", body: JSON.stringify({ data, note }) }),
  resetState: () => request("/state", { method: "DELETE" }),
  getInfo: () => request("/info"),
  listFiles: () => request("/files"),
  uploadFiles: (files = []) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return request("/files", { method: "POST", body: formData });
  },
};
