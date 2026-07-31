import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import { useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import ProjectNode from './ProjectNode';

const nodeTypes = { project: ProjectNode };
const SCALE = 150;
const MIN_CONFIDENCE_FOR_EDGE = 0.3;

// Node radius in pixels by timeframe — must match the sizes in ProjectNode.jsx
// w-24 = 96px, w-28 = 112px, w-32 = 128px, w-36 = 144px, divided by 2 for radius
const RADIUS_MAP = {
  weekend: 48,
  week:    56,
  month:   64,
  summer:  72,
};
const DEFAULT_RADIUS = 56;
const PADDING = 1; // extra gap between node edges after collision resolution

function applyForceLayout(projects) {
  if (projects.length === 0) return [];

  // Step 1: create simulation nodes from UMAP coordinates
  // We copy x/y into fx/fy as "target" positions — the positioning force
  // will pull each node back toward these, so semantic layout is preserved
  const simNodes = projects.map((p) => ({
    id: p.id,
    x: p.x * SCALE,
    y: p.y * SCALE,
    targetX: p.x * SCALE,
    targetY: p.y * SCALE,
    radius: (RADIUS_MAP[p.timeframe] || DEFAULT_RADIUS) + PADDING,
  }));

  // Step 2: build the simulation
  // We don't run this live — we tick it a fixed number of times and
  // read the final positions. This is called a "static" simulation.
  const simulation = d3.forceSimulation(simNodes)
    // Collision force: keeps node circles from overlapping
    // Each node is treated as a circle with its radius + padding
    .force('collide', d3.forceCollide()
      .radius((d) => d.radius)
      .strength(0.9)   // how aggressively to resolve overlaps (0-1)
      .iterations(4)   // more iterations = more accurate but slower
    )
    // Positioning force: weak spring pulling each node back toward
    // its original UMAP position. Strength 0.3 means the collision
    // force can move nodes but they won't drift far from their semantic spot
    .force('x', d3.forceX((d) => d.targetX).strength(0.3))
    .force('y', d3.forceY((d) => d.targetY).strength(0.3))
    // No link or charge forces — we only want collision + position
    .stop(); // don't start the animation loop

  // Step 3: run the simulation for enough ticks to converge
  // 300 ticks is plenty for datasets under 100 nodes
  // alphaDecay controls how quickly the simulation "cools down"
  simulation.alphaDecay(0.01);
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // Step 4: return adjusted positions keyed by project id
  const positionById = {};
  simNodes.forEach((n) => {
    positionById[n.id] = { x: n.x, y: n.y };
  });
  return positionById;
}

function buildNodes(projects, devMode) {
  if (projects.length === 0) return [];

  // Run force layout to get collision-resolved positions
  const positions = applyForceLayout(projects);

  return projects.map((p) => ({
    id: p.id,
    type: 'project',
    position: positions[p.id] || { x: p.x * SCALE, y: p.y * SCALE },
    data: {
      name: p.name,
      description: p.description,
      tools: p.tools,
      timeframe: p.timeframe,
      url: p.url,
      cluster_id: p.cluster_id,
      confidence: p.confidence,
      github_status: p.github_status,
      github_days_since: p.github_days_since,
      github_stars: p.github_stars,
      github_language: p.github_language,
      devMode,
      x: p.x,
      y: p.y,
    },
    draggable: true,
  }));
}

function buildEdges(projects) {
  const edges = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];
      const sameCluster = a.cluster_id === b.cluster_id && a.cluster_id !== -1;
      const bothConfident =
        a.confidence >= MIN_CONFIDENCE_FOR_EDGE &&
        b.confidence >= MIN_CONFIDENCE_FOR_EDGE;
      if (sameCluster && bothConfident) {
        const avgConfidence = (a.confidence + b.confidence) / 2;
        edges.push({
          id: `${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
          type: 'straight',
          style: {
            stroke: '#6b7280',
            strokeWidth: 1.5,
            opacity: avgConfidence * 0.8,
          },
          animated: false,
        });
      }
    }
  }
  return edges;
}

function GraphViewInner({ projects, onNodeClick, devMode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  // Rebuild nodes/edges and refit the viewport whenever projects change.
  // The 50ms delay lets ReactFlow process the new node positions before
  // fitView measures the bounding box — without it fitView reads stale layout.
  useEffect(() => {
    setNodes(buildNodes(projects, devMode));
    setEdges(buildEdges(projects));
    const t = setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
    return () => clearTimeout(t);
  }, [projects, devMode]);

  const handleNodeClick = useCallback((event, node) => {
    const project = projects.find((p) => p.id === node.id);
    if (project) onNodeClick(project);

    setEdges((eds) =>
      eds.map((edge) => {
        const isConnected = edge.source === node.id || edge.target === node.id;
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: isConnected ? '#60a5fa' : '#6b7280',
            strokeWidth: isConnected ? 3 : 1.5,
            opacity: isConnected ? 1 : 0.15,
          },
        };
      })
    );
  }, [projects, onNodeClick]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setEdges(buildEdges(projects))}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={3}
        attributionPosition="bottom-left"
      >
        <Background color="#374151" gap={24} />
        <Controls className="bg-gray-800 border-gray-600" />
        <MiniMap
          nodeColor={(node) => {
            const cid = node.data?.cluster_id;
            const colors = ['#2563eb','#9333ea','#16a34a','#ea580c',
                            '#db2777','#0d9488','#dc2626','#ca8a04'];
            return cid >= 0 ? colors[cid % colors.length] : '#6b7280';
          }}
          className="bg-gray-800 border border-gray-700"
        />
      </ReactFlow>
    </div>
  );
}

// ReactFlowProvider is required so that GraphViewInner can call useReactFlow()
// to access fitView. Without the provider, useReactFlow() throws because it
// expects to be inside a ReactFlow context.
export default function GraphView(props) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}