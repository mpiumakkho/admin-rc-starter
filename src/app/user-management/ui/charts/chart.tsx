import { Chart, type ChartData, type ChartOptions, type ChartType, type Plugin } from 'chart.js';
import { useLayoutEffect, useMemo, useRef } from 'react';

import { useUiAccessibleView } from '../theme/accessible-view.service';
import { useChartTheme } from './chart-theme';
import './chart.scss';

/** Room above the tallest bar for its number */
const VALUE_ROOM = 20;

/**
 * Writes each bar's number above it, so reading one does not take hovering a bar with the mouse (the accessible view,
 * WCAG 2.1.3), in the color of the axis text
 */
const BAR_VALUES: Plugin = {
  id: 'uiBarValues',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = String(Chart.defaults.color);
    ctx.font = `600 12px ${Chart.defaults.font.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    chart.data.datasets.forEach((dataset, index) => {
      const meta = chart.getDatasetMeta(index);
      if (meta.type === 'bar' && chart.isDatasetVisible(index)) {
        meta.data.forEach((bar, item) => ctx.fillText(String(dataset.data[item] ?? ''), bar.x, bar.y - 4));
      }
    });
    ctx.restore();
  },
};

export interface UiChartProps<TType extends ChartType = ChartType> {
  type: TType;
  data: ChartData<TType>;
  options?: ChartOptions<TType>;
  label?: string;
}

/**
 * A Chart.js chart that follows the light or dark theme. It brings Chart.js with it, so load it lazily and the page
 * opens without waiting for Chart.js (the Angular app's @defer):
 *
 *   const UiChart = lazy(() => import('../ui/charts/chart').then(m => ({ default: m.UiChart })));
 *   <Suspense fallback={<div></div>}><UiChart type="bar" data={data} options={options} label={summary} /></Suspense>
 *
 * With a label the chart is an image with that text for screen readers; without one it is hidden from them, for
 * charts whose numbers are shown next to them. In the accessible view a bar chart writes its numbers on the bars.
 */
export function UiChart<TType extends ChartType = ChartType>({ type, data, options, label }: UiChartProps<TType>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart<TType> | null>(null);
  const accessible = useUiAccessibleView(state => state.on);
  const barValues = accessible && type === 'bar';

  const plugins = useMemo(() => (barValues ? [BAR_VALUES] : []) as Plugin<TType>[], [barValues]);
  const chartOptions = useMemo(() => {
    if (!barValues) {
      return options;
    }
    const layout = (options as ChartOptions<'bar'> | undefined)?.layout;
    return { ...options, layout: { ...layout, padding: { top: VALUE_ROOM } } } as ChartOptions<TType>;
  }, [options, barValues]);

  const latest = useRef({ type, data, options: chartOptions, plugins });
  latest.current = { type, data, options: chartOptions, plugins };

  /** Draws the chart from scratch, as ng2-charts' render() does */
  const render = () => {
    chart.current?.destroy();
    const { type: kind, data: points, options: settings, plugins: extras } = latest.current;
    chart.current = new Chart(canvas.current!, { type: kind, data: points, options: settings, plugins: extras });
  };

  useChartTheme(render);

  useLayoutEffect(() => {
    render();
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, [type, plugins]);

  // New data or options update the chart in place, so it moves to them
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (chart.current) {
      chart.current.data = data;
      chart.current.options = (chartOptions ?? {}) as NonNullable<typeof chartOptions>;
      chart.current.update();
    }
  }, [data, chartOptions]);

  return (
    <ui-chart>
      <canvas ref={canvas} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}></canvas>
    </ui-chart>
  );
}
