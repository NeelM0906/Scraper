import { api } from './modules/api.js';
import { DashboardRenderer } from './modules/renderers.js';
import { notificationManager, modalManager, ProgressManager } from './modules/ui-utils.js';

class App {
    constructor() {
        this.renderer = new DashboardRenderer();
        this.currentSection = 'dashboard';
        this.dashboardData = null;
        this.campaigns = [];
        this.currentCampaign = null;
        this.progressManager = null;

        // Initialize
        this.init();
    }

    async init() {
        this.progressManager = new ProgressManager('campaignProgressModal');
        this.setupEventListeners();
        this.setupRealTimeUpdates();

        // Load initial data
        await this.loadDashboardData();
        await this.loadCampaigns();

        // Initial render
        this.showSection('dashboard');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSection(section);
            });
        });

        // New campaign
        const newCampaignBtn = document.getElementById('newCampaignBtn');
        if (newCampaignBtn) {
            newCampaignBtn.addEventListener('click', () => this.openNewCampaignModal());
        }

        // Form submission
        const form = document.getElementById('newCampaignForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createCampaign();
            });
        }

        // Filters
        document.getElementById('campaignSearch')?.addEventListener('input',
            api.debounce(() => this.filterCampaigns(), 300)
        );
        document.getElementById('industryFilter')?.addEventListener('change', () => this.filterCampaigns());

        // Leads Filters
        document.getElementById('campaignSelect')?.addEventListener('change', (e) => {
            if (e.target.value) this.loadCampaignLeads(e.target.value);
        });

        // Campaign Form Industry Auto-fill
        document.getElementById('campaignIndustry')?.addEventListener('change', (e) => {
            this.updateCampaignFormDefaults(e.target.value);
        });
    }

    setupRealTimeUpdates() {
        api.connectToEvents(
            (data) => this.handleRealTimeUpdate(data),
            (error) => console.error('SSE Error:', error)
        );
    }

    handleRealTimeUpdate(data) {
        switch (data.type) {
            case 'campaign_started':
                notificationManager.show('Campaign Started', data.message, 'info');
                break;
            case 'campaign_progress':
                if (this.progressManager) this.progressManager.updateProgress(data.progress, data.message);
                break;
            case 'campaign_completed':
                if (this.progressManager) this.progressManager.complete(data.results);
                notificationManager.show('Campaign Complete', data.message, 'success');
                setTimeout(() => {
                    this.loadDashboardData();
                    this.loadCampaigns();
                }, 2000);
                break;
            case 'campaign_failed':
                if (this.progressManager) this.progressManager.error(data.message);
                notificationManager.show('Campaign Failed', data.message, 'error');
                break;
        }
    }

    showSection(sectionName) {
        this.currentSection = sectionName;
        this.renderer.showSection(sectionName);

        switch (sectionName) {
            case 'dashboard':
                this.renderer.renderDashboard(this.dashboardData);
                break;
            case 'campaigns':
                this.renderer.renderCampaigns(this.campaigns);
                break;
            case 'leads':
                this.renderer.renderLeads(this.currentCampaign, this.currentCampaign?.leads);
                break;
            case 'analytics':
                this.loadAndRenderAnalytics();
                break;
            case 'merge':
                // Force re-render of merge section to ensure list is up to date
                this.renderMergeSection();
                break;
        }
    }

    async loadDashboardData() {
        try {
            this.dashboardData = await api.getDashboard();
            if (this.currentSection === 'dashboard') {
                this.renderer.renderDashboard(this.dashboardData);
            }
        } catch (error) {
            api.handleError(error, 'loading dashboard');
        }
    }

    async loadCampaigns() {
        try {
            this.campaigns = await api.getCampaigns();
            this.populateCampaignSelect();
            if (this.currentSection === 'campaigns') {
                this.renderer.renderCampaigns(this.campaigns);
            }
        } catch (error) {
            api.handleError(error, 'loading campaigns');
        }
    }

    async loadCampaignLeads(campaignId) {
        try {
            api.showLoading('leadsTable', 'Loading leads...');
            this.currentCampaign = await api.getCampaign(campaignId);
            this.renderer.renderLeads(this.currentCampaign, this.currentCampaign.leads);
        } catch (error) {
            api.handleError(error, 'loading leads');
        }
    }

    async loadAndRenderAnalytics() {
        try {
            api.showLoading('industryChart');
            const analytics = await api.getAnalytics();
            this.renderer.renderAnalytics(analytics);
        } catch (error) {
            api.handleError(error, 'loading analytics');
        }
    }

    populateCampaignSelect() {
        const select = document.getElementById('campaignSelect');
        if (select && this.campaigns) {
            select.innerHTML = '<option value="">Select Campaign</option>';
            this.campaigns.forEach(campaign => {
                const option = document.createElement('option');
                option.value = campaign.id;
                option.textContent = `${campaign.name} (${campaign.results?.totalLeads || 0} leads)`;
                select.appendChild(option);
            });
        }
    }

    filterCampaigns() {
        const searchTerm = document.getElementById('campaignSearch')?.value.toLowerCase() || '';
        const industryFilter = document.getElementById('industryFilter')?.value || '';

        const filtered = this.campaigns.filter(c => {
            const nameMatch = c.name.toLowerCase().includes(searchTerm) || c.industry.toLowerCase().includes(searchTerm);
            const typeMatch = industryFilter ? c.industry === industryFilter : true;
            return nameMatch && typeMatch;
        });

        this.renderer.renderCampaigns(filtered);
    }

    // Modal Actions
    openNewCampaignModal() {
        if (this.dashboardData?.userPreferences) {
            const industry = this.dashboardData.userPreferences.industry;
            const industrySelect = document.getElementById('campaignIndustry');
            if (industrySelect && industry) {
                industrySelect.value = industry;
                this.updateCampaignFormDefaults(industry);
            }
        }
        modalManager.open('newCampaignModal');
    }

    closeNewCampaignModal() {
        modalManager.close();
        document.getElementById('newCampaignForm').reset();
    }

    updateCampaignFormDefaults(industry) {
        const queryInput = document.getElementById('searchQuery');
        if (queryInput && !queryInput.value) {
            const queries = {
                restaurant: 'Italian Restaurant New York',
                automotive: 'Car Dealer Los Angeles',
                realestate: 'Real Estate Agents Miami',
                healthcare: 'Dentist Chicago',
                professional: 'Law Firms Boston',
            };
            if (queries[industry]) queryInput.value = queries[industry];
            else queryInput.value = `${industry} New York`; // Default to US city
        }
    }

    async createCampaign() {
        const form = document.getElementById('newCampaignForm');
        const formData = new FormData(form);
        const campaignData = Object.fromEntries(formData.entries());

        // Enforce Zip Grid Validation
        if (!campaignData.zipStart || !campaignData.zipEnd) {
            return notificationManager.show('Error', 'Please enter a valid Zip Code Range', 'error');
        }

        try {
            this.closeNewCampaignModal();
            this.progressManager.show(campaignData.name);
            const result = await api.createCampaign(campaignData);
            if (result.success) notificationManager.show('Campaign Started', 'Running in background', 'success');
        } catch (error) {
            this.progressManager.error(error.message);
            api.handleError(error, 'creating campaign');
        }
    }

    async viewCampaign(campaignId) {
        try {
            const campaign = await api.getCampaign(campaignId);
            this.currentCampaign = campaign;
            this.renderer.showCampaignDetail(campaign);
        } catch (error) {
            api.handleError(error, 'viewing campaign');
        }
    }

    // --- New Features Logic ---

    // Edit/Delete
    openEditCampaignModal() {
        if (!this.currentCampaign) return;
        document.getElementById('editCampaignName').value = this.currentCampaign.name;
        modalManager.open('editCampaignModal');
    }

    closeEditCampaignModal() {
        modalManager.close();
    }

    async saveCampaignEdit() {
        const newName = document.getElementById('editCampaignName').value;
        if (!newName) return;

        try {
            await api.updateCampaign(this.currentCampaign.id, { name: newName });
            this.currentCampaign.name = newName;
            this.renderer.showCampaignDetail(this.currentCampaign); // Refresh view
            this.closeEditCampaignModal();
            notificationManager.show('Success', 'Campaign updated', 'success');
            this.loadCampaigns(); // Refresh list
        } catch (error) {
            api.handleError(error, 'updating campaign');
        }
    }

    async deleteCampaign() {
        if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
        try {
            await api.deleteCampaign(this.currentCampaign.id);
            notificationManager.show('Success', 'Campaign deleted', 'success');
            this.showSection('campaigns');
            this.loadCampaigns();
        } catch (error) {
            api.handleError(error, 'deleting campaign');
        }
    }

    exportCampaignCSV() {
        if (this.currentCampaign) {
            api.exportCampaignCSV(this.currentCampaign.id);
        }
    }

    // Merging
    renderMergeSection() {
        const container = document.getElementById('mergeCampaignList');
        if (!container) return;

        if (this.campaigns) {
            container.innerHTML = this.campaigns.map(c => `
            <div class="checkbox-item" style="padding: 0.75rem; display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid var(--border-color);">
                <input type="checkbox" name="mergeSelect" value="${c.id}" id="merge_${c.id}" style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
                <label for="merge_${c.id}" style="cursor: pointer; flex: 1; display: flex; justify-content: space-between; align-items: center; margin: 0;">
                    <span style="font-weight: 500; font-size: 1rem;">${c.name}</span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">${c.results?.totalLeads || 0} leads</span>
                </label>
            </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="loading">No campaigns found</div>';
        }
    }

    async mergeCampaigns() {
        const checkboxes = document.querySelectorAll('input[name="mergeSelect"]:checked');
        const ids = Array.from(checkboxes).map(cb => cb.value);
        const name = document.getElementById('mergeName').value;

        if (ids.length < 2) {
            return notificationManager.show('Review', 'Please select at least 2 campaigns to merge', 'warning');
        }
        if (!name) {
            return notificationManager.show('Review', 'Please enter a name for the new dataset', 'warning');
        }

        try {
            notificationManager.show('Merging', 'Combining datasets...', 'info');
            const result = await api.mergeCampaigns(ids, name);
            if (result.success) {
                notificationManager.show('Success', 'Datasets merged successfully!', 'success');
                // Refresh campaigns and go to list
                await this.loadCampaigns();
                this.showSection('campaigns');
            }
        } catch (error) {
            api.handleError(error, 'merging campaigns');
        }
    }

    // --- Report Generation ---
    generateAndShowReport() {
        if (!this.currentCampaign || !this.currentCampaign.leads) return;

        const c = this.currentCampaign;
        const leads = c.leads;
        const stats = c.results || { totalLeads: leads.length, averageScore: 0 };

        // Calculate Priority Counts (backend results might be stale if leads modified, so recalc)
        const highPriority = leads.filter(l => (l.intelligence?.priority || 'LOW') === 'HIGH').length;
        const mediumPriority = leads.filter(l => (l.intelligence?.priority || 'LOW') === 'MEDIUM').length;
        const lowPriority = leads.filter(l => (l.intelligence?.priority || 'LOW') === 'LOW').length;

        let report = `Lead Intelligence Report
══════════════════════════════════════════════════
Industry: ${(c.industry || 'Unknown').toUpperCase()}
Total Leads: ${leads.length}
Average Score: ${stats.averageScore}
High Priority: ${highPriority} leads
Medium Priority: ${mediumPriority} leads
Low Priority: ${lowPriority} leads

🏆 Top 5 Prospects:
──────────────────────────────
`;

        // Top 5
        const sortedLeads = [...leads].sort((a, b) => (b.intelligence?.score || 0) - (a.intelligence?.score || 0));
        sortedLeads.slice(0, 5).forEach((l, i) => {
            const score = l.intelligence?.score || 0;
            const category = l.intelligence?.category || 'N/A';
            const rec = l.intelligence?.recommendation || 'N/A';
            report += `${i + 1}. ${l.name} (Score: ${score})
   Category: ${category}
   Recommendation: ${rec}

`;
        });

        report += `💡 Insights:
──────────────────────
`;

        // 1. Digital Presence Insight
        const lowDigitalLeads = leads.filter(l => {
            // Check factors if available
            if (l.intelligence?.factors?.digitalPresence !== undefined) {
                return l.intelligence.factors.digitalPresence < 50;
            }
            // Fallback: No website or very little info
            return (!l.website || l.website === 'N/A') && (!l.phone);
        });

        if (lowDigitalLeads.length > 0) {
            report += `• ${lowDigitalLeads.length} leads have low digital presence - good digitalization prospects\n`;
            // List names
            lowDigitalLeads.slice(0, 15).forEach(l => {
                report += `  - ${l.name}\n`;
            });
            if (lowDigitalLeads.length > 15) report += `  ...and ${lowDigitalLeads.length - 15} more\n`;
            report += '\n';
        }

        // 2. High Value Insight
        if (highPriority > 0) {
            report += `• ${highPriority} High Priority leads identified for immediate outreach\n`;
        }

        document.getElementById('reportTextContent').textContent = report;
        modalManager.open('reportModal');
    }

    closeReportModal() {
        modalManager.close();
    }

    copyReportToClipboard() {
        const text = document.getElementById('reportTextContent').textContent;
        navigator.clipboard.writeText(text).then(() => {
            notificationManager.show('Copied', 'Report copied to clipboard', 'success');
        });
    }

    exportLeadVCard(campaignId, index, name) {
        api.exportLeadVCard(campaignId, index, name);
    }
}

// Global App Instance
window.app = new App();

// Global Helpers for HTML attributes
window.closeNewCampaignModal = () => window.app.closeNewCampaignModal();
window.closeCampaignProgressModal = () => window.app.progressManager.hide();
window.backToCampaigns = () => window.app.showSection('campaigns');
window.sendWhatsApp = (content) => window.open(`https://wa.me/?text=${encodeURIComponent(content)}`, '_blank');
window.exportCampaignCSV = () => window.app.exportCampaignCSV();
window.openEditCampaignModal = () => window.app.openEditCampaignModal();
window.closeEditCampaignModal = () => window.app.closeEditCampaignModal();
window.saveCampaignEdit = () => window.app.saveCampaignEdit();
window.deleteCampaign = () => window.app.deleteCampaign();
// Report Helpers
window.generateAndShowReport = () => window.app.generateAndShowReport();
window.closeReportModal = () => window.app.closeReportModal();
window.copyReportToClipboard = () => window.app.copyReportToClipboard();
