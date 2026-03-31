import type { ForecastPoint } from "../lib/types";

interface ForecastChartProps {
	points: ForecastPoint[];
}

export function ForecastChart({ points }: ForecastChartProps) {
	if (points.length === 0) {
		return null;
	}

	const width = 520;
	const height = 220;
	const paddingX = 32;
	const paddingTop = 20;
	const paddingBottom = 34;
	const chartWidth = width - paddingX * 2;
	const chartHeight = height - paddingTop - paddingBottom;
	const maxValue = Math.max(...points.map((point) => point.value), 1);

	const plottedPoints = points.map((point, index) => {
		const x = paddingX + (index / Math.max(points.length - 1, 1)) * chartWidth;
		const y =
			paddingTop + chartHeight - (point.value / maxValue) * chartHeight;

		return {
			...point,
			x,
			y,
		};
	});

	const line = plottedPoints
		.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
		.join(" ");
	const firstPoint = plottedPoints[0];
	const lastPoint = plottedPoints[plottedPoints.length - 1];
	const area = `${line} L ${lastPoint.x} ${height - paddingBottom} L ${firstPoint.x} ${height - paddingBottom} Z`;

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			className="h-auto w-full"
			aria-label="Illustrative forecast chart"
		>
			<defs>
				<linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor="rgba(251, 146, 60, 0.38)" />
					<stop offset="100%" stopColor="rgba(251, 146, 60, 0.04)" />
				</linearGradient>
			</defs>

			<line
				x1={paddingX}
				y1={height - paddingBottom}
				x2={width - paddingX}
				y2={height - paddingBottom}
				stroke="rgba(15, 23, 42, 0.14)"
				strokeWidth="1"
			/>
			<path d={area} fill="url(#forecastFill)" />
			<path
				d={line}
				fill="none"
				stroke="rgb(234, 88, 12)"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>

			{plottedPoints.map((point) => (
				<g key={point.label}>
					<circle
						cx={point.x}
						cy={point.y}
						r="4"
						fill="white"
						stroke="rgb(234, 88, 12)"
						strokeWidth="3"
					/>
					<text
						x={point.x}
						y={point.y - 12}
						textAnchor="middle"
						fontSize="11"
						fill="rgb(71, 85, 105)"
					>
						{point.value}
					</text>
					<text
						x={point.x}
						y={height - 8}
						textAnchor="middle"
						fontSize="11"
						fill="rgb(100, 116, 139)"
					>
						{point.label}
					</text>
				</g>
			))}
		</svg>
	);
}
