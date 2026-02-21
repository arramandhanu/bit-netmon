'use client';

import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts/core';
import {
    LineChart,
    BarChart,
    GaugeChart,
    type LineSeriesOption,
    type BarSeriesOption,
    type GaugeSeriesOption,
} from 'echarts/charts';
import {
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    ToolboxComponent,
    type TitleComponentOption,
    type TooltipComponentOption,
    type LegendComponentOption,
    type GridComponentOption,
    type DataZoomComponentOption,
    type ToolboxComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register components once
echarts.use([
    LineChart,
    BarChart,
    GaugeChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    ToolboxComponent,
    CanvasRenderer,
]);

type EChartsOption = echarts.ComposeOption<
    | LineSeriesOption
    | BarSeriesOption
    | GaugeSeriesOption
    | TitleComponentOption
    | TooltipComponentOption
    | LegendComponentOption
    | GridComponentOption
    | DataZoomComponentOption
    | ToolboxComponentOption
>;

// ─── Chart colors ───────────────────────────────────────
const THEME_COLORS = [
    '#60a5fa', // blue-400
    '#34d399', // emerald-400
    '#fbbf24', // amber-400
    '#f87171', // red-400
    '#a78bfa', // violet-400
    '#fb923c', // orange-400
    '#2dd4bf', // teal-400
    '#e879f9', // fuchsia-400
];

// ─── Base Chart Component ───────────────────────────────

interface BaseChartProps {
    option: EChartsOption;
    height?: string | number;
    className?: string;
    loading?: boolean;
    onInit?: (chart: echarts.ECharts) => void;
}

export function BaseChart({
    option,
    height = 300,
    className = '',
    loading = false,
    onInit,
}: BaseChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = echarts.init(chartRef.current);
        instanceRef.current = chart;
        onInit?.(chart);

        const observer = new ResizeObserver(() => chart.resize());
        observer.observe(chartRef.current);

        return () => {
            observer.disconnect();
            chart.dispose();
            instanceRef.current = null;
        };
    }, [onInit]);

    useEffect(() => {
        if (!instanceRef.current) return;

        if (loading) {
            instanceRef.current.showLoading('default', {
                text: '',
                color: '#60a5fa',
                maskColor: 'rgba(255, 255, 255, 0.7)',
            });
        } else {
            instanceRef.current.hideLoading();
            instanceRef.current.setOption(option, { notMerge: true });
        }
    }, [option, loading]);

    return (
        <div
            ref={chartRef}
            className={className}
            style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
        />
    );
}

// ─── Traffic Chart ──────────────────────────────────────

interface TrafficChartProps {
    data: Array<{
        bucket: string;
        avg_in_bps?: number;
        avg_out_bps?: number;
        max_in_bps?: number;
        max_out_bps?: number;
    }>;
    height?: number;
    title?: string;
    loading?: boolean;
    showMax?: boolean;
}

function formatBps(value: number): string {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Gbps`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)} Mbps`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)} Kbps`;
    return `${value.toFixed(0)} bps`;
}

export function TrafficChart({
    data,
    height = 300,
    title,
    loading = false,
    showMax = false,
}: TrafficChartProps) {
    const option = useMemo<EChartsOption>(() => {
        const times = data.map((d) => d.bucket);
        const series: LineSeriesOption[] = [
            {
                name: 'Inbound',
                type: 'line',
                data: data.map((d) => d.avg_in_bps ?? 0),
                smooth: true,
                areaStyle: { opacity: 0.15 },
                lineStyle: { width: 2 },
                itemStyle: { color: THEME_COLORS[0] },
            },
            {
                name: 'Outbound',
                type: 'line',
                data: data.map((d) => d.avg_out_bps ?? 0),
                smooth: true,
                areaStyle: { opacity: 0.15 },
                lineStyle: { width: 2 },
                itemStyle: { color: THEME_COLORS[1] },
            },
        ];

        if (showMax) {
            series.push(
                {
                    name: 'Max In',
                    type: 'line',
                    data: data.map((d) => d.max_in_bps ?? 0),
                    lineStyle: { width: 1, type: 'dashed' },
                    itemStyle: { color: THEME_COLORS[0] },
                    symbol: 'none',
                },
                {
                    name: 'Max Out',
                    type: 'line',
                    data: data.map((d) => d.max_out_bps ?? 0),
                    lineStyle: { width: 1, type: 'dashed' },
                    itemStyle: { color: THEME_COLORS[1] },
                    symbol: 'none',
                },
            );
        }

        return {
            backgroundColor: 'transparent',
            title: title ? { text: title, textStyle: { fontSize: 14 } } : undefined,
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v: unknown) => formatBps(Number(v)),
            },
            legend: { bottom: 0 },
            grid: { top: title ? 40 : 20, right: 20, bottom: 40, left: 60 },
            xAxis: { type: 'category', data: times, boundaryGap: false },
            yAxis: {
                type: 'value',
                axisLabel: { formatter: (v: number) => formatBps(v) },
            },
            dataZoom: [{ type: 'inside', start: 0, end: 100 }],
            series,
            color: THEME_COLORS,
        };
    }, [data, title, showMax]);

    return <BaseChart option={option} height={height} loading={loading} />;
}

// ─── Sparkline Chart ────────────────────────────────────

interface SparklineChartProps {
    data: number[];
    height?: number;
    color?: string;
    areaColor?: string;
}

export function SparklineChart({
    data,
    height = 40,
    color = THEME_COLORS[0],
    areaColor,
}: SparklineChartProps) {
    const option = useMemo<EChartsOption>(
        () => ({
            backgroundColor: 'transparent',
            grid: { top: 2, right: 2, bottom: 2, left: 2 },
            xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
            yAxis: { type: 'value', show: false },
            series: [
                {
                    type: 'line',
                    data,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 1.5, color },
                    areaStyle: { color: areaColor || color, opacity: 0.1 },
                },
            ],
        }),
        [data, color, areaColor],
    );

    return <BaseChart option={option} height={height} />;
}

// ─── Utilization Gauge ──────────────────────────────────

interface GaugeChartProps {
    value: number;
    title?: string;
    height?: number;
    thresholds?: [number, string][];
}

export function UtilizationGauge({
    value,
    title = '',
    height = 200,
    thresholds = [
        [0.6, THEME_COLORS[1]],  // green < 60%
        [0.85, THEME_COLORS[2]], // amber 60-85%
        [1, THEME_COLORS[3]],    // red > 85%
    ],
}: GaugeChartProps) {
    const option = useMemo<EChartsOption>(
        () => ({
            backgroundColor: 'transparent',
            series: [
                {
                    type: 'gauge',
                    center: ['50%', '60%'],
                    radius: '90%',
                    min: 0,
                    max: 100,
                    splitNumber: 5,
                    axisLine: {
                        lineStyle: {
                            width: 12,
                            color: thresholds,
                        },
                    },
                    axisTick: { show: false },
                    splitLine: { length: 8, lineStyle: { width: 1, color: '#cbd5e1' } },
                    axisLabel: { distance: 18, fontSize: 10, color: '#64748b' },
                    pointer: { width: 4, length: '60%', itemStyle: { color: '#334155' } },
                    detail: {
                        valueAnimation: true,
                        fontSize: 20,
                        offsetCenter: [0, '70%'],
                        formatter: '{value}%',
                        color: '#1e293b',
                    },
                    title: {
                        offsetCenter: [0, '90%'],
                        fontSize: 12,
                        color: '#64748b',
                    },
                    data: [{ value: Math.round(value * 10) / 10, name: title }],
                },
            ],
        }),
        [value, title, thresholds],
    );

    return <BaseChart option={option} height={height} />;
}

// ─── Time Series Chart (CPU, Memory, Response Time) ─────

interface TimeSeriesChartProps {
    data: Array<{
        bucket: string;
        [key: string]: unknown;
    }>;
    series: Array<{
        name: string;
        dataKey: string;
        color?: string;
        unit?: string;
    }>;
    height?: number;
    title?: string;
    loading?: boolean;
}

export function TimeSeriesChart({
    data,
    series,
    height = 300,
    title,
    loading = false,
}: TimeSeriesChartProps) {
    const option = useMemo<EChartsOption>(() => {
        const times = data.map((d) => d.bucket);

        const chartSeries: LineSeriesOption[] = series.map((s, i) => ({
            name: s.name,
            type: 'line',
            data: data.map((d) => Number(d[s.dataKey]) || 0),
            smooth: true,
            lineStyle: { width: 2 },
            itemStyle: { color: s.color || THEME_COLORS[i % THEME_COLORS.length] },
            areaStyle: { opacity: 0.08 },
        }));

        const unit = series[0]?.unit || '';

        return {
            backgroundColor: 'transparent',
            title: title ? { text: title, textStyle: { fontSize: 14 } } : undefined,
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v: unknown) => `${Number(v).toFixed(1)}${unit}`,
            },
            legend: { bottom: 0 },
            grid: { top: title ? 40 : 20, right: 20, bottom: 40, left: 50 },
            xAxis: { type: 'category', data: times, boundaryGap: false },
            yAxis: {
                type: 'value',
                axisLabel: { formatter: `{value}${unit}` },
            },
            dataZoom: [{ type: 'inside', start: 0, end: 100 }],
            series: chartSeries,
            color: THEME_COLORS,
        };
    }, [data, series, title]);

    return <BaseChart option={option} height={height} loading={loading} />;
}

// ─── Bar Chart ──────────────────────────────────────────

interface BarChartProps {
    categories: string[];
    data: Array<{
        name: string;
        values: number[];
        color?: string;
    }>;
    height?: number;
    title?: string;
    loading?: boolean;
    horizontal?: boolean;
}

export function StatusBarChart({
    categories,
    data,
    height = 300,
    title,
    loading = false,
    horizontal = false,
}: BarChartProps) {
    const option = useMemo<EChartsOption>(() => {
        const chartSeries: BarSeriesOption[] = data.map((d, i) => ({
            name: d.name,
            type: 'bar',
            data: d.values,
            itemStyle: { color: d.color || THEME_COLORS[i % THEME_COLORS.length] },
            barMaxWidth: 40,
        }));

        const catAxis = { type: 'category' as const, data: categories };
        const valAxis = { type: 'value' as const };

        return {
            backgroundColor: 'transparent',
            title: title ? { text: title, textStyle: { fontSize: 14 } } : undefined,
            tooltip: { trigger: 'axis' },
            legend: { bottom: 0 },
            grid: { top: title ? 40 : 20, right: 20, bottom: 40, left: 50 },
            xAxis: horizontal ? valAxis : catAxis,
            yAxis: horizontal ? catAxis : valAxis,
            series: chartSeries,
            color: THEME_COLORS,
        };
    }, [categories, data, title, horizontal]);

    return <BaseChart option={option} height={height} loading={loading} />;
}
