import { useState, useEffect, useCallback } from "react";
import api from "./api/axios";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./components/AuthPage";
import ProjectForm from "./components/ProjectForm";
import GraphView from "./components/GraphView";

export default function App() {
  const { user, logout, loading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) {
      api.get("/api/projects").then((res) => {
        setProjects(res.data.projects);
      });
    }
  }, [user]);

  const handleProjectAdded = useCallback((responseData) => {
    setProjects(responseData.projects);
    setSelectedProject(null);
  }, []);

  const handleNodeClick = useCallback((project) => {
    setSelectedProject(project);
    setShowForm(false);
    setConfirmDelete(false);
  }, []);

  async function handleDelete(projectId) {
    const res = await api.delete(`/api/projects/${projectId}`);
    setProjects(res.data.projects);
    setSelectedProject(null);
    setConfirmDelete(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="flex h-screen bg-gray-900 text-white">

      {/* Left sidebar */}
      <div className="p-2 border-b border-gray-700 flex justify-end gap-2">
        <button
          onClick={() => setDevMode((prev) => !prev)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            devMode
              ? 'bg-green-700 text-white'
              : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {devMode ? 'DEV ON' : 'DEV OFF'}
          </button>
          <button
            onClick={logout}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
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
                <div
                  key={p.id}
                  className={`flex items-center gap-1 rounded-lg border transition-colors ${
                    selectedProject?.id === p.id
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 hover:border-gray-500 bg-gray-800'
                  }`}
                >
                  <button
                    onClick={() => { setSelectedProject(p); setShowForm(false); setConfirmDelete(false); }}
                    className="flex-1 text-left px-3 py-2"
                  >
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.timeframe}</p>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-2 py-2 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    title="Delete project"
                  >
                    ✕
                  </button>
                </div>
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
          devMode={devMode}
        />

        {/* Detail panel — floats over the graph when a node is selected */}
        {selectedProject && (
          <div className="absolute top-4 right-4 w-72 bg-gray-800/95 backdrop-blur border border-gray-600 rounded-xl p-4 shadow-xl">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-base leading-tight pr-2">
                {selectedProject.name}
              </h3>
              <button
                onClick={() => { setSelectedProject(null); setConfirmDelete(false); }}
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
            {/* Delete */}
            <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
              {confirmDelete ? (
                <>
                  <button
                    onClick={() => handleDelete(selectedProject.id)}
                    className="flex-1 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="py-1.5 px-3 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Delete project
                </button>
              )}
            </div>

            {/* Dev mode info */}
            {devMode && (
              <div className="mt-3 pt-3 border-t border-gray-600 font-mono text-[11px] text-green-400 flex flex-col gap-1">
                <p>cluster: {selectedProject.cluster_id === -1 ? 'noise' : selectedProject.cluster_id}</p>
                <p>confidence: {(selectedProject.confidence * 100).toFixed(1)}%</p>
                <p>x: {selectedProject.x?.toFixed(4)}</p>
                <p>y: {selectedProject.y?.toFixed(4)}</p>
                <p>id: {selectedProject.id}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}