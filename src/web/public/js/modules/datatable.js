import { api } from './api.js';

export default class DataTable {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            columns: [],
            data: [],
            pagination: true,
            pageSize: 10,
            sortable: true,
            filterable: false,
            campaignId: null,
            ...options
        };
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.filteredData = [];
    }

    render() {
        this.filteredData = [...this.options.data];
        this.applySort();

        const tableHTML = this.generateTable();
        const paginationHTML = this.options.pagination ? this.generatePagination() : '';

        this.container.innerHTML = `
            ${tableHTML}
            ${paginationHTML}
        `;

        this.attachEventListeners();
    }

    generateTable() {
        const startIndex = (this.currentPage - 1) * this.options.pageSize;
        const endIndex = startIndex + this.options.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        return `
            <table class="leads-table">
                <thead>
                    <tr>
                        ${this.options.columns.map(col => `
                            <th ${this.options.sortable ? `class="sortable" data-column="${col.key}"` : ''}>
                                ${col.title}
                                ${this.sortColumn === col.key ? (this.sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${pageData.length > 0 ? pageData.map((row, index) => `
                        <tr>
                            ${this.options.columns.map(col => {
            // Get the actual value from nested properties if needed
            let cellValue = row[col.key];
            if (col.key && col.key.includes('.')) {
                const keys = col.key.split('.');
                cellValue = keys.reduce((obj, key) => obj?.[key], row);
            }
            return `<td>${this.formatCellValue(cellValue, col, row, index)}</td>`;
        }).join('')}
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="${this.options.columns.length}" class="empty-state">
                                <div class="empty-icon">📭</div>
                                <div class="empty-title">No data available</div>
                                <div class="empty-message">There are no items to display</div>
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
        `;
    }

    formatCellValue(value, column, rowData, rowIndex) {
        if (column.formatter) {
            return column.formatter(value, rowData, rowIndex);
        }

        // Get the actual value from nested properties if needed
        let actualValue = value;
        if (column.key && column.key.includes('.')) {
            const keys = column.key.split('.');
            actualValue = keys.reduce((obj, key) => obj?.[key], rowData);
        }

        if (column.type === 'actions') {
            const safeName = (rowData.name || 'Unknown').replace(/'/g, "\\'");
            return `
                <div class="action-buttons">
                    <button class="btn-vcard" onclick="window.app.exportLeadVCard('${this.options.campaignId}', ${rowIndex}, '${safeName}')" title="Export to Phone Contacts">
                        📱 vCard
                    </button>
                </div>
            `;
        }

        if (column.type === 'score') {
            const numericValue = api.parseNumericValue(actualValue);
            if (numericValue === null) {
                return '<span class="score-badge score-unknown" style="background: #f3f4f6; color: #6b7280;">No Score</span>';
            }
            const category = api.getScoreCategory(numericValue);
            const color = api.getScoreColor(numericValue);
            return `<span class="score-badge" style="background: ${color}20; color: ${color};">${numericValue} - ${category}</span>`;
        }

        if (column.type === 'priority') {
            const safeValue = api.safeString(actualValue, 'UNKNOWN');
            const normalizedValue = safeValue.toUpperCase();
            const color = api.getPriorityColor(normalizedValue);
            const displayValue = normalizedValue === 'UNKNOWN' ? 'Unknown' : normalizedValue;
            return `<span class="priority-badge priority-${normalizedValue.toLowerCase()}" style="background: ${color};">${displayValue}</span>`;
        }

        if (column.type === 'date') {
            return api.formatDateSafe(actualValue);
        }

        if (column.type === 'number') {
            return api.formatNumber(actualValue);
        }

        // Handle general value formatting
        return api.safeString(actualValue);
    }

    generatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);

        if (totalPages <= 1) return '';

        let paginationHTML = '<div class="pagination">';

        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="this.closest('.leads-table-container').querySelector('.pagination button.prev').click()">
                Previous
            </button>
        `;
        // Hack: The onclick above is tricky because 'this' context. 
        // Better to handle click events in attachEventListeners and use dataset references.
        // Let's rewrite generatePagination to use data attributes and handling in attachEventListeners.

        // Actually, the original code used `this.table.goToPage`. 
        // In the module system, we need to bind the instance properly.
        // I will use data-page attributes and a delegated event listener in the container.

        // Re-doing pagination HTML simpler:

        paginationHTML = '<div class="pagination">';

        // Previous
        paginationHTML += `<button class="page-btn prev" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">Previous</button>`;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        // Next
        paginationHTML += `<button class="page-btn next" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Next</button>`;

        paginationHTML += '</div>';
        return paginationHTML;
    }

    attachEventListeners() {
        // Pagination clicks
        const paginationContainer = this.container.querySelector('.pagination');
        if (paginationContainer) {
            const paginationButtons = paginationContainer.querySelectorAll('button');
            paginationButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = parseInt(btn.dataset.page);
                    if (page && !isNaN(page)) {
                        this.goToPage(page);
                    }
                });
            });
            // Oh wait, `paginationButtons = ...` is missing const/let.
            // And in original code:
            // `button.table = this;`
            // `onclick="this.table.goToPage(...)"`
            // That relied on DOM property assignment.
            // I'll stick to addEventListener closure.

            const buttons = paginationContainer.querySelectorAll('.page-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const page = parseInt(e.target.dataset.page);
                    if (page) this.goToPage(page);
                });
            });
        }

        // Sort functionality
        if (this.options.sortable) {
            const sortableHeaders = this.container.querySelectorAll('th.sortable');
            sortableHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.column;
                    this.sort(column);
                });
            });
        }
    }

    sort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.applySort();
        this.render();
    }

    applySort() {
        if (!this.sortColumn) return;

        this.filteredData.sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];

            if (this.sortColumn.includes('.')) {
                const keys = this.sortColumn.split('.');
                aVal = keys.reduce((obj, key) => obj?.[key], a);
                bVal = keys.reduce((obj, key) => obj?.[key], b);
            }

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();

            if (this.sortDirection === 'asc') {
                return aStr.localeCompare(bStr);
            } else {
                return bStr.localeCompare(aStr);
            }
        });
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        this.currentPage = Math.max(1, Math.min(page, totalPages));
        this.render();
    }

    updateData(newData) {
        this.options.data = newData;
        this.currentPage = 1;
        this.render();
    }

    filter(filterFn) {
        this.filteredData = this.options.data.filter(filterFn);
        this.currentPage = 1;
        this.render();
    }
}
