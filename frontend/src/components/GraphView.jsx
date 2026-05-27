import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import { useMemo, useEffect, useCallback } from 'react';
import ProjectNode from './ProjectNode';

// Register your custom node type
const nodeTypes = { project: ProjectNode };

// How much to scale UMAP coordinates into pixels
// UMAP output is roughly in the range -5 to 5, so *150 gives -750 to 750px
const SCALE = 150;

// Only draw an edge if cosine similarity exceeds this threshold
// We approximate similarity using cluster membership — same cluster = draw edge
const MIN_CONFIDENCE_FOR_EDGE = 0.4;

function buildNodes(projects) {
  return projects.map((p) => ({
    id: p.id,
    type: 'project',           // tells React Flow to use ProjectNode
    position: {
      x: p.x * SCALE,
      y: p.y * SCALE,
    },
    data: {                    // everything in here is passed to ProjectNode as `data`
      name: p.name,
      description: p.description,
      tools: p.tools,
      timeframe: p.timeframe,
      url: p.url,
      cluster_id: p.cluster_id,
      confidence: p.confidence,
    },
    // Prevent users from dragging nodes out of their semantic position
    draggable: true,
  }));
}

function buildEdges(projects) {
  const edges = [];

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];

      // Draw an edge between two nodes if:
      // 1. They share the same cluster (cluster_id matches and isn't -1)
      // 2. Both have sufficient confidence in that cluster
      const sameCluster = a.cluster_id === b.cluster_id && a.cluster_id !== -1;
      const bothConfident =
        a.confidence >= MIN_CONFIDENCE_FOR_EDGE &&
        b.confidence >= MIN_CONFIDENCE_FOR_EDGE;

      if (sameCluster && bothConfident) {
        // Edge opacity scales with the average confidence of both endpoints
        const avgConfidence = (a.confidence + b.confidence) / 2;

        edges.push({
          id: `${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
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

export default function GraphView({ projects, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Recompute nodes and edges whenever projects changes
  useEffect(() => {
    setNodes(buildNodes(projects));
    setEdges(buildEdges(projects));
  }, [projects]);

  const handleNodeClick = useCallback((event, node) => {
    // Find the full project object and pass it up to App
    const project = projects.find((p) => p.id === node.id);
    if (project) onNodeClick(project);
  }, [projects, onNodeClick]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView                        // auto-zoom to fit all nodes on load
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