import { useState } from "react";
import axios from "axios";
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

export default function ProjectForm({ onProjectAdded }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

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
        id: crypto.randomUUID(),
        name: form.name.trim(),
        description: form.description.trim(),
        tools: form.tools,
        timeframe: form.timeframe,
        url: form.url.trim() || null,
      };

      const response = await axios.post("/api/projects", payload);
      
      // Tell the parent a project was added, passing back the full response
      onProjectAdded(response.data);
      
      // Reset form
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
      </div>

      {/* Error message */}
      {status === "error" && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {status === "loading"
          ? "Categorizing..."
          : status === "success"
          ? "Added!"
          : "Add Project"}
      </button>
    </form>
  );
}