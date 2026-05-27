import { Handle, Position } from 'reactflow';

// A fixed set of colors, one per cluster id (0-7)
// cluster_id -1 (noise) maps to gray via the fallback at the bottom
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

export default function ProjectNode({ data, selected }) {
  const clusterId = data.cluster_id;
  const color = clusterId >= 0
    ? CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length]
    : { bg: 'bg-gray-600', ring: 'ring-gray-400' };

  // Node size scales with timeframe
  const sizeMap = {
    weekend: 'w-24 h-24',
    week:    'w-28 h-28',
    month:   'w-32 h-32',
    summer:  'w-36 h-36',
  };
  const size = sizeMap[data.timeframe] || 'w-28 h-28';

  // Confidence drives opacity — low confidence nodes appear faded
  const opacity = 0.4 + (data.confidence * 0.6);

  return (
    <>
      {/* Handles are invisible connection points React Flow uses for edges */}
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div
        style={{ opacity }}
        className={`
          ${size} ${color.bg}
          ${selected ? `ring-4 ${color.ring}` : ''}
          rounded-full flex flex-col items-center justify-center
          text-white text-center cursor-pointer
          transition-all duration-200 hover:scale-110 shadow-lg
          p-2
        `}
      >
        <p className="text-xs font-semibold leading-tight line-clamp-2">
          {data.name}
        </p>
        <p className="text-[10px] text-white/70 mt-1">
          {data.timeframe}
        </p>
        {/* Confidence indicator dot */}
        {data.confidence < 0.5 && (
          <span
            title="Low confidence cluster assignment"
            className="mt-1 text-[10px] bg-white/20 rounded px-1"
          >
            ?
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
}