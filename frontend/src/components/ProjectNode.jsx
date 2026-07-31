import { Handle, Position } from 'reactflow';

const CLUSTER_COLORS = [
  { bg: 'bg-blue-600',   ring: 'ring-blue-400' },
  { bg: 'bg-purple-600', ring: 'ring-purple-400' },
  { bg: 'bg-green-600',  ring: 'ring-green-400' },
  { bg: 'bg-orange-500', ring: 'ring-orange-400' },
  { bg: 'bg-pink-600',   ring: 'ring-pink-400' },
  { bg: 'bg-teal-600',   ring: 'ring-teal-400' },
  { bg: 'bg-red-600',    ring: 'ring-red-400' },
  { bg: 'bg-yellow-500', ring: 'ring-yellow-400' },
];

// Status ring styles — outer border color independent of cluster fill
const STATUS_STYLES = {
  active:    { border: '#22c55e' },
  stale:     { border: '#eab308' },
  dormant:   { border: '#6b7280' },
  completed: { border: '#3b82f6' },
  idea:      { border: '#4b5563' },
};

export default function ProjectNode({ data, selected }) {
  const clusterId = data.cluster_id;
  const color = clusterId >= 0
    ? CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length]
    : { bg: 'bg-gray-600', ring: 'ring-gray-400' };

  const sizeMap = {
    weekend: 'w-24 h-24',
    week:    'w-28 h-28',
    month:   'w-32 h-32',
    summer:  'w-36 h-36',
  };
  const size = sizeMap[data.timeframe] || 'w-28 h-28';
  const opacity = 0.4 + (data.confidence * 0.6);

  const status = data.github_status || 'idea';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.idea;

  // Dashed border for "idea" (no GitHub link), solid for everything else
  const borderStyle = status === 'idea'
    ? { border: `3px dashed ${statusStyle.border}` }
    : { border: `3px solid ${statusStyle.border}` };

  // outline doesn't affect layout or the D3 collision radius — it renders
  // outside the box model so nodes won't overlap due to the status indicator
  const outlineStyle = {
    outline: `3px ${status === 'idea' ? 'dashed' : 'solid'} ${statusStyle.border}`,
    outlineOffset: '0px',
  };

  return (
    <div className="relative overflow-visible flex flex-col items-center">

      <Handle type="target" position={Position.Top}
        style={{ left: '50%', top: '50%', opacity: 0, pointerEvents: 'none' }} />

      {/* The cluster-colored circle with status outline */}
      <div
        style={{ opacity, ...outlineStyle }}
        className={`
          ${size} ${color.bg}
          ${selected ? `ring-4 ${color.ring}` : ''}
          rounded-full flex flex-col items-center justify-center
          text-white text-center cursor-pointer
          transition-all duration-200 hover:scale-110 shadow-lg p-2
        `}
      >
        <p className="text-xs font-semibold leading-tight line-clamp-2">
          {data.name}
        </p>
        <p className="text-[10px] text-white/70 mt-1">
          {data.timeframe}
        </p>
        {data.confidence < 0.5 && (
          <span className="mt-1 text-[10px] bg-white/20 rounded px-1">?</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ left: '50%', top: '50%', opacity: 0, pointerEvents: 'none' }} />
    </div>
  );
}
