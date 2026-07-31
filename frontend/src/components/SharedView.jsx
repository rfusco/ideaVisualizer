import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import GraphView from './GraphView';

// Bare axios instance — no auth header injection, no 401 redirect
const publicApi = axios.create({ baseURL: '/' });

const STATUS_COLOR = {
  active:    'text-green-400',
  stale:     'text-yellow-400',
  dormant:   'text-gray-400',
  completed: 'text-blue-400',
};

export default function SharedView() {
  const { shareToken } = useParams();
  const [projects, setProjects] = useState([]);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'notfound'

  useEffect(() => {
    publicApi.get(`/api/share/${shareToken}`)
      .then((res) => {
        setProjects(res.data.projects);
        setOwnerEmail(res.data.owner_email);
        setState('ready');
      })
      .catch((err) => {
        if (err.response?.status === 404) setState('notfound');
        else setState('notfound');
      });
  }, [shareToken]);

  const handleNodeClick = useCallback((project) => {
    setSelectedProject(project);
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-gray-400">
        Loading...
      </div>
    );
  }

  if (state === 'notfound') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-center gap-3">
        <p className="text-2xl font-semibold text-white">Link not found</p>
        <p className="text-gray-400 text-sm">This share link has been revoked or doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Read-only banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-sm text-gray-300">
          <span className="font-medium text-white">{ownerEmail}</span>'s idea graph
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400 tracking-wide">
          READ ONLY
        </span>
      </div>

      {/* Graph area */}
      <div className="flex-1 relative">
        <GraphView
          projects={projects}
          onNodeClick={handleNodeClick}
          devMode={false}
        />

        {/* Read-only detail panel */}
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
            <p className="text-gray-300 text-sm mb-3">{selectedProject.description}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedProject.tools.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-blue-600 text-xs rounded-md">{t}</span>
              ))}
            </div>
            <div className="text-xs text-gray-400 flex flex-col gap-1">
              <span>Timeframe: {selectedProject.timeframe}</span>
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

            {selectedProject.github_status && selectedProject.github_status !== 'idea' && (
              <div className="mt-2 pt-2 border-t border-gray-700 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={STATUS_COLOR[selectedProject.github_status]}>●</span>
                  <span className="text-xs text-gray-300 capitalize">{selectedProject.github_status}</span>
                  {selectedProject.github_stars > 0 && (
                    <span className="ml-auto text-xs text-gray-400">⭐ {selectedProject.github_stars}</span>
                  )}
                </div>
                {selectedProject.github_days_since != null && (
                  <span className="text-xs text-gray-500">
                    Last commit: {selectedProject.github_days_since === 0 ? 'today' : `${selectedProject.github_days_since}d ago`}
                  </span>
                )}
                {selectedProject.github_language && (
                  <span className="text-xs text-gray-500">Language: {selectedProject.github_language}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
