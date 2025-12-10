import { api } from './api.js';

export default class SimpleChart {
    static createBarChart(container, data, options = {}) {
        const {
            title = '',
            valueKey = 'value',
            labelKey = 'label',
            color = '#2563eb'
        } = options;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <div class="chart-icon">📊</div>
                    <div class="chart-text">No data available</div>
                </div>
            `;
            return;
        }

        const maxValue = Math.max(...data.map(item => item[valueKey]));

        const chartHTML = `
            ${title ? `<h4 style="margin-bottom: 1rem; text-align: center;">${title}</h4>` : ''}
            <div class="bar-chart">
                ${data.map(item => {
            const height = (item[valueKey] / maxValue) * 100;
            return `
                        <div class="bar-item">
                            <div class="bar" style="height: ${height}%; background: ${color};">
                                <div class="bar-value">${api.formatNumber(item[valueKey])}</div>
                            </div>
                            <div class="bar-label">${item[labelKey]}</div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        container.innerHTML = chartHTML;
    }

    static createPieChart(container, data, options = {}) {
        const { title = '' } = options;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <div class="chart-icon">🥧</div>
                    <div class="chart-text">No data available</div>
                </div>
            `;
            return;
        }

        const total = data.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

        let currentAngle = 0;
        const segments = data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            const color = colors[index % colors.length];

            const segment = {
                ...item,
                percentage,
                angle,
                startAngle: currentAngle,
                color
            };

            currentAngle += angle;
            return segment;
        });

        const gradientStops = segments.map(segment =>
            `${segment.color} ${segment.startAngle}deg ${segment.startAngle + segment.angle}deg`
        ).join(', ');

        const chartHTML = `
            ${title ? `<h4 style="margin-bottom: 1rem; text-align: center;">${title}</h4>` : ''}
            <div class="pie-chart">
                <div class="pie-visual" style="background: conic-gradient(${gradientStops});"></div>
                <div class="pie-legend">
                    ${segments.map(segment => `
                        <div class="legend-item">
                            <div class="legend-color" style="background: ${segment.color};"></div>
                            <div class="legend-label">${segment.label}</div>
                            <div class="legend-value">${api.formatNumber(segment.value)} (${segment.percentage.toFixed(1)}%)</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = chartHTML;
    }
}
