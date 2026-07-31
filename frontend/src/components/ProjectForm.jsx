import { useState, useEffect } from "react";
import api from "../api/axios";
import TagInput from "./TagInput";

const TIMEFRAME_OPTIONS = [
  { value: "weekend", label: "Weekend (1–2 days)" },
  { value: "week", label: "1–2 Weeks" },
  { value: "month", label: "About a Month" },
  { value: "summer", label: "Full Summer" },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  tools: [],
  timeframe: "week",
  url: "",
};

export default function ProjectForm({ onProjectAdded, editingProject, onCancelEdit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [githubNotice, setGithubNotice] = useState(false);

  // When editingProject is set, populate the form with its values.
  // When it's cleared (cancel or save), reset back to the empty form.
  useEffect(() => {
    if (editingProject) {
      setForm({
        name:        editingProject.name,
        description: editingProject.description,
        tools:       editingProject.tools,
        timeframe:   editingProject.timeframe,
        url:         editingProject.url || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setStatus("idle");
    setErrorMessage("");
    setGithubNotice(false);
  }, [editingProject]);

  // GitHub auto-fill: when the URL field looks like a GitHub repo URL,
  // wait 600ms then fetch repo metadata and pre-fill empty fields.
  // Only fills name/description/tools if they are currently blank —
  // never overwrites something the user already typed.
  useEffect(() => {
    if (editingProject) return; // don't auto-fill when editing an existing project
    const isGithub = /^https?:\/\/github\.com\/[^/]+\/[^/]+/.test(form.url);
    if (!isGithub) return;

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/github/repo-info?url=${encodeURIComponent(form.url)}`);
        const data = res.data;
        setForm((prev) => ({
          ...prev,
          name:        prev.name        || data.github_name        || prev.name,
          description: prev.description || data.github_description || prev.description,
          tools:       prev.tools.length > 0
                         ? prev.tools
                         : [...(data.github_topics || []), data.github_language].filter(Boolean),
        }));
        setGithubNotice(true);
        setTimeout(() => setGithubNotice(false), 3000);
      } catch {
        // Silently ignore — repo might be private or URL not fully typed yet
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form.url, editingProject]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Basic validation
    if (!form.name.trim()) {
      setErrorMessage("Project name is required.");
      setStatus("error");
      return;
    }
    if (!form.description.trim()) {
      setErrorMessage("Description is required.");
      setStatus("error");
      return;
    }
    if (form.tools.length === 0) {
      setErrorMessage("Add at least one tool.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const payload = {
        id: editingProject ? editingProject.id : crypto.randomUUID(),
        name: form.name.trim(),
        description: form.description.trim(),
        tools: form.tools,
        timeframe: form.timeframe,
        url: form.url.trim() || null,
      };

      const response = await api.post("/api/projects", payload);
      
      // Tell the parent a project was added, passing back the full response
      onProjectAdded(response.data);
      if (editingProject && onCancelEdit) onCancelEdit();
      setForm(EMPTY_FORM);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || "Something went wrong. Is the backend running?"
      );
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Project Name */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-300">
          Project Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="e.g. Custom TCP/IP Stack"
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-300">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="What is this project? What will you build or learn?"
          rows={4}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Tools */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-300">
          Tools / Technologies <span className="text-red-400">*</span>
        </label>
        <TagInput
          tags={form.tools}
          onChange={(newTags) => updateField("tools", newTags)}
        />
        <p className="text-xs text-gray-500">Press Enter or comma to add each tool.</p>
      </div>

      {/* Timeframe */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-300">Timeframe</label>
        <select
          value={form.timeframe}
          onChange={(e) => updateField("timeframe", e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIMEFRAME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* URL (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-300">
          Project URL{" "}
          <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => updateField("url", e.target.value)}
          placeholder="https://github.com/you/project"
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {githubNotice && (
          <p className="text-xs text-green-400">Auto-filled from GitHub</p>
        )}
      </div>

      {/* Error message */}
      {status === "error" && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      )}

      {/* Submit */}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {status === "loading"
            ? "Saving..."
            : status === "success"
            ? (editingProject ? "Saved!" : "Added!")
            : (editingProject ? "Save Changes" : "Add Project")}
        </button>
        {editingProject && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}