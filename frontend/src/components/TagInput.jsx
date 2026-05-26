import { useState } from "react";

export default function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");

  function handleKeyDown(e) {
    // Add tag on enter or comma
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      const newTag = input.trim().replace(/,$/, "");
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInput("");
    }
    // Remove last tag on backspace if input is empty
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(index) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border border-gray-600 rounded-lg bg-gray-800 min-h-[44px] focus-within:ring-2 focus-within:ring-blue-500">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-sm rounded-md"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="hover:text-red-300 font-bold leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "Type a tool and press Enter..." : ""}
        className="flex-1 min-w-[120px] bg-transparent text-white outline-none text-sm placeholder-gray-500"
      />
    </div>
  );
}