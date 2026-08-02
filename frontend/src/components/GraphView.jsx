import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import ForceGraph3D from 'react-force-graph-3d';
import ProjectNode from './ProjectNode';

const nodeTypes = { project: ProjectNode };
const SCALE = 150;
const MIN_CONFIDENCE_FOR_EDGE = 0.3;

// Shared cluster color palette — hex values used by both 2D MiniMap and 3D nodes
const CLUSTER_COLORS = [
  '#2563eb', '#9333ea', '#16a34a', '#ea580c',
  '#db2777', '#0d9488', '#dc2626', '#ca8a04',
];

function clusterHex(clusterId) {
  return clusterId >= 0 ? CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length] : '#6b7280';
}

// ---------------------------------------------------------------------------
// 2D helpers (unchanged)
// ---------------------------------------------------------------------------
const RADIUS_MAP = { weekend: 48, week: 56, month: 64, summer: 72 };
const DEFAULT_RADIUS = 56;
const PADDING = 1;

function applyForceLayout(projects) {
  if (projects.length === 0) return {};
  const simNodes = projects.map((p) => ({
    id: p.id,
    x: p.x * SCALE,
    y: p.y * SCALE,
    targetX: p.x * SCALE,
    targetY: p.y * SCALE,
    radius: (RADIUS_MAP[p.timeframe] || DEFAULT_RADIUS) + PADDING,
  }));
  const simulation = d3.forceSimulation(simNodes)
    .force('collide', d3.forceCollide().radius((d) => d.radius).strength(0.9).iterations(4))
    .force('x', d3.forceX((d) => d.targetX).strength(0.3))
    .force('y', d3.forceY((d) => d.targetY).strength(0.3))
    .stop();
  simulation.alphaDecay(0.01);
  for (let i = 0; i < 300; i++) simulation.tick();
  const positionById = {};
  simNodes.forEach((n) => { positionById[n.id] = { x: n.x, y: n.y }; });
  return positionById;
}

function buildNodes(projects, devMode) {
  if (projects.length === 0) return [];
  const positions = applyForceLayout(projects);
  return projects.map((p) => ({
    id: p.id,
    type: 'project',
    position: positions[p.id] || { x: p.x * SCALE, y: p.y * SCALE },
    data: {
      name: p.name, description: p.description, tools: p.tools,
      timeframe: p.timeframe, url: p.url, cluster_id: p.cluster_id,
      confidence: p.confidence, github_status: p.github_status,
      github_days_since: p.github_days_since, github_stars: p.github_stars,
      github_language: p.github_language, devMode, x: p.x, y: p.y,
    },
    draggable: true,
  }));
}

function buildEdges(projects) {
  const edges = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i], b = projects[j];
      if (a.cluster_id === b.cluster_id && a.cluster_id !== -1 &&
          a.confidence >= MIN_CONFIDENCE_FOR_EDGE && b.confidence >= MIN_CONFIDENCE_FOR_EDGE) {
        const avg = (a.confidence + b.confidence) / 2;
        edges.push({
          id: `${a.id}-${b.id}`, source: a.id, target: b.id, type: 'straight',
          style: { stroke: '#6b7280', strokeWidth: 1.5, opacity: avg * 0.8 },
          animated: false,
        });
      }
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// 2D view (ReactFlow — unchanged)
// ---------------------------------------------------------------------------
function GraphView2D({ projects, onNodeClick, devMode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(buildNodes(projects, devMode));
    setEdges(buildEdges(projects));
    const t = setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
    return () => clearTimeout(t);
  }, [projects, devMode]);

  const handleNodeClick = useCallback((event, node) => {
    const project = projects.find((p) => p.id === node.id);
    if (project) onNodeClick(project);
    setEdges((eds) => eds.map((edge) => {
      const isConnected = edge.source === node.id || edge.target === node.id;
      return { ...edge, style: {
        ...edge.style,
        stroke: isConnected ? '#60a5fa' : '#6b7280',
        strokeWidth: isConnected ? 3 : 1.5,
        opacity: isConnected ? 1 : 0.15,
      }};
    }));
  }, [projects, onNodeClick]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setEdges(buildEdges(projects))}
        nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2} maxZoom={3} attributionPosition="bottom-left"
      >
        <Background color="#374151" gap={24} />
        <Controls className="bg-gray-800 border-gray-600" />
        <MiniMap
          nodeColor={(node) => clusterHex(node.data?.cluster_id)}
          className="bg-gray-800 border border-gray-700"
        />
      </ReactFlow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3D view (react-force-graph-3d)
// ---------------------------------------------------------------------------

// How large each node sphere is — scaled to match 2D timeframe sizes visually
const TIMEFRAME_VAL = { weekend: 4, week: 6, month: 8, summer: 11 };

function GraphView3D({ projects, onNodeClick }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  // Measure the container so the canvas fills it exactly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build the graph data structure react-force-graph expects.
  // We use the UMAP x,y,z as initial positions so the semantic layout
  // is preserved — the 3D force simulation then resolves collisions from there.
  const graphData = useMemo(() => {
    const nodes = projects.map((p) => ({
      id: p.id,
      // Spread UMAP coords into a readable space
      x: p.x * SCALE,
      y: p.y * SCALE,
      z: (p.z ?? 0) * SCALE,
      // Keep all project fields on the node for the click handler
      _project: p,
    }));

    const links = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i], b = projects[j];
        if (a.cluster_id === b.cluster_id && a.cluster_id !== -1 &&
            a.confidence >= MIN_CONFIDENCE_FOR_EDGE && b.confidence >= MIN_CONFIDENCE_FOR_EDGE) {
          links.push({ source: a.id, target: b.id });
        }
      }
    }

    return { nodes, links };
  }, [projects]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#111827' }}>
      <ForceGraph3D
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="#111827"
        // Node appearance: cluster color, timeframe-driven size
        nodeColor={(node) => clusterHex(node._project?.cluster_id)}
        nodeVal={(node) => TIMEFRAME_VAL[node._project?.timeframe] ?? 6}
        nodeLabel={(node) => node._project?.name ?? ''}
        nodeOpacity={0.9}
        // Edges: same cluster connections as 2D
        linkColor={() => '#4b5563'}
        linkOpacity={0.4}
        linkWidth={1}
        // Clicking a node fires the same detail-panel handler as 2D
        onNodeClick={(node) => {
          if (node._project) onNodeClick(node._project);
        }}
        // Warm up the simulation quickly so nodes settle from their UMAP positions
        warmupTicks={60}
        cooldownTicks={0}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — picks 2D or 3D based on `mode` prop
// ---------------------------------------------------------------------------
export default function GraphView({ projects, onNodeClick, devMode, mode = '2d' }) {
  if (mode === '3d') {
    return <GraphView3D projects={projects} onNodeClick={onNodeClick} />;
  }
  return (
    <ReactFlowProvider>
      <GraphView2D projects={projects} onNodeClick={onNodeClick} devMode={devMode} />
    </ReactFlowProvider>
  );
}
