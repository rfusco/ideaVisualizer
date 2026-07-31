import { useState, useEffect, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import api from "./api/axios";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./components/AuthPage";
import ProjectForm from "./components/ProjectForm";
import GraphView from "./components/GraphView";
import SharedView from "./components/SharedView";

export default function App() {
  return (
    <Routes>
      <Route path="/share/:shareToken" element={<SharedView />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
}

function MainApp() {
  const { user, logout, loading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy link");

  useEffect(() => {
    if (user) {
      api.get("/api/projects").then((res) => setProjects(res.data.projects));
      api.get("/api/share/status").then((res) => setShareToken(res.data.share_token));
    }
  }, [user]);

  async function handleShare() {
    if (shareToken) {
      setShowSharePopover((prev) => !prev);
      return;
    }
    const res = await api.post("/api/share/token");
    setShareToken(res.data.share_token);
    setShowSharePopover(true);
  }

  async function handleRevoke() {
    await api.delete("/api/share/token");
    setShareToken(null);
    setShowSharePopover(false);
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy link"), 2000);
  }

  // Close the share popover when clicking anywhere outside it
  useEffect(() => {
    if (!showSharePopover) return;
    function handleClickOutside(e) {
      if (!e.target.closest('[data-share-popover]')) setShowSharePopover(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSharePopover]);

  const handleProjectAdded = useCallback((responseData) => {
    setProjects(responseData.projects);
    setSelectedProject(null);
  }, []);

  const handleNodeClick = useCallback((project) => {
    setSelectedProject(project);
    setShowForm(false);
    setConfirmDelete(false);
    setEditingProject(null);
  }, []);

  function handleEdit(project) {
    setEditingProject(project);
    setSelectedProject(null);
    setShowForm(true);
    setConfirmDelete(false);
  }

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
      <div className="w-80 flex flex-col border-r border-gray-700 shrink-0">

        {/* Sidebar header — buttons stay fixed, never scroll */}
        <div className="p-2 border-b border-gray-700 flex justify-end gap-2 shrink-0">
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

          {/* Share button + popover */}
          <div className="relative" data-share-popover>
            <button
              onClick={handleShare}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                shareToken
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              Share
            </button>
            {showSharePopover && shareToken && (
              <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-gray-800 border border-gray-600 rounded-xl p-3 shadow-xl flex flex-col gap-2">
                <p className="text-xs text-gray-400">Anyone with this link can view your graph:</p>
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={`${window.location.origin}/share/${shareToken}`}
                    className="flex-1 text-xs bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-gray-300 truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="text-xs px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors shrink-0"
                  >
                    {copyLabel}
                  </button>
                </div>
                <button
                  onClick={handleRevoke}
                  className="text-xs text-red-400 hover:text-red-300 text-left transition-colors"
                >
                  Revoke link
                </button>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Scrollable sidebar content */}
        <div className="flex flex-col overflow-y-auto flex-1">

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
            <ProjectForm
              onProjectAdded={handleProjectAdded}
              editingProject={editingProject}
              onCancelEdit={() => setEditingProject(null)}
            />
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
        </div> {/* end scrollable content */}
      </div> {/* end sidebar */}

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

            {/* GitHub metadata — only shown when github_status is set and not "idea" */}
            {selectedProject.github_status && selectedProject.github_status !== 'idea' && (
              <div className="mt-2 pt-2 border-t border-gray-700 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={{
                    active:    'text-green-400',
                    stale:     'text-yellow-400',
                    dormant:   'text-gray-400',
                    completed: 'text-blue-400',
                  }[selectedProject.github_status]}>
                    ●
                  </span>
                  <span className="text-xs text-gray-300 capitalize">{selectedProject.github_status}</span>
                  {selectedProject.github_stars > 0 && (
                    <span className="ml-auto text-xs text-gray-400">⭐ {selectedProject.github_stars}</span>
                  )}
                </div>
                {selectedProject.github_days_since !== null && selectedProject.github_days_since !== undefined && (
                  <span className="text-xs text-gray-500">
                    Last commit: {selectedProject.github_days_since === 0
                      ? 'today'
                      : `${selectedProject.github_days_since}d ago`}
                  </span>
                )}
                {selectedProject.github_language && (
                  <span className="text-xs text-gray-500">Language: {selectedProject.github_language}</span>
                )}
              </div>
            )}
            {/* Edit / Delete */}
            <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
              {!confirmDelete && (
                <button
                  onClick={() => handleEdit(selectedProject)}
                  className="py-1.5 px-3 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  Edit
                </button>
              )}
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