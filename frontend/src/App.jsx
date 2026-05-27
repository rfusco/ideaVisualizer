import { useState, useEffect } from "react";
import axios from "axios";
import ProjectForm from "./components/ProjectForm";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  // Load projects from backend on first render
  useEffect(() => {
    axios.get("/api/projects").then((res) => {
      setProjects(res.data.projects);
    });
  }, []); // empty array = runs once on mount

  function handleProjectAdded(responseData) {
    setProjects(responseData.projects);
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">

      {/* Left sidebar — form + list */}
      <div className="w-80 flex flex-col border-r border-gray-700 overflow-y-auto">

        {/* Form section */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Add Project</h2>
          <ProjectForm onProjectAdded={handleProjectAdded} />
        </div>

        {/* List section */}
        <div className="p-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            Projects{" "}
            <span className="text-sm text-gray-400 font-normal">
              ({projects.length})
            </span>
          </h2>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">No projects yet. Add one above.</p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                  selectedProject?.id === p.id
                    ? "border-blue-500 bg-blue-900/30"
                    : "border-gray-700 hover:border-gray-500 bg-gray-800"
                }`}
              >
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.timeframe}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main area — graph will go here */}
      <div className="flex-1 flex items-center justify-center">
        {selectedProject ? (
          <div className="max-w-md p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h3 className="text-xl font-semibold">{selectedProject.name}</h3>
            <p className="text-gray-400 text-sm mt-2">{selectedProject.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedProject.tools.map((t) => (
                <span key={t} className="px-2 py-1 bg-blue-600 text-xs rounded-md">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Timeframe: {selectedProject.timeframe}</p>
            {selectedProject.url && (
              <a
                href={selectedProject.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline mt-1 block"
              >
                {selectedProject.url}
              </a>
            )}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">
            Graph will render here. Add a project to get started.
          </p>
        )}
      </div>

    </div>
  );
}