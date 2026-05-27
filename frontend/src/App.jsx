import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ProjectForm from "./components/ProjectForm";
import GraphView from "./components/GraphView";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    axios.get("/api/projects").then((res) => {
      setProjects(res.data.projects);
    });
  }, []);

  function handleProjectAdded(responseData) {
    setProjects(responseData.projects);
    setSelectedProject(null);
  }

  const handleNodeClick = useCallback((project) => {
    setSelectedProject(project);
    setShowForm(false);
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-white">

      {/* Left sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-700 overflow-y-auto shrink-0">

        {/* Tab switcher */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setShowForm(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              showForm
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Add Project
          </button>
          <button
            onClick={() => setShowForm(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !showForm
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Projects ({projects.length})
          </button>
        </div>

        {showForm ? (
          <div className="p-4">
            <ProjectForm onProjectAdded={handleProjectAdded} />
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-2">
            {projects.length === 0 ? (
              <p className="text-sm text-gray-500">No projects yet.</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    selectedProject?.id === p.id
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 hover:border-gray-500 bg-gray-800'
                  }`}
                >
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.timeframe}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main graph area */}
      <div className="flex-1 relative">
        <GraphView
          projects={projects}
          onNodeClick={handleNodeClick}
        />

        {/* Detail panel — floats over the graph when a node is selected */}
        {selectedProject && (
          <div className="absolute top-4 right-4 w-72 bg-gray-800/95 backdrop-blur border border-gray-600 rounded-xl p-4 shadow-xl">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-base leading-tight pr-2">
                {selectedProject.name}
              </h3>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-gray-400 hover:text-white shrink-0"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              {selectedProject.description}
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedProject.tools.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-blue-600 text-xs rounded-md">
                  {t}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-400 flex flex-col gap-1">
              <span>Timeframe: {selectedProject.timeframe}</span>
              <span>
                Cluster confidence:{' '}
                <span className={
                  selectedProject.confidence > 0.7 ? 'text-green-400' :
                  selectedProject.confidence > 0.4 ? 'text-yellow-400' : 'text-red-400'
                }>
                  {Math.round(selectedProject.confidence * 100)}%
                </span>
              </span>
              {selectedProject.url && (
                <a
                  href={selectedProject.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline mt-1"
                >
                  Project link ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}