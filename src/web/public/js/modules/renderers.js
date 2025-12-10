import { api } from './api.js';
import SimpleChart from './charts.js';
import DataTable from './datatable.js';
import { notificationManager } from './ui-utils.js';

export class DashboardRenderer {
    constructor() {
        this.leadsTable = null;
        this.detailLeadsTable = null;
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        const activeSection = document.getElementById(`${sectionName}-section`);
        if (activeSection) activeSection.classList.add('active');
    }

    renderDashboard(data) {
        if (!data) return;

        const { overview, recentActivity } = data;

        // Update overview cards
        const safeText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        safeText('totalCampaigns', api.formatNumber(overview.totalCampaigns || 0));
        safeText('totalLeads', api.formatNumber(overview.totalLeads || 0));
        safeText('priorityLeads', api.formatNumber(overview.totalPriorityLeads || 0));
        safeText('averageScore', api.parseNumericValue(overview.averageScore) || '0');

        this.updateUserInfo(data.userPreferences?.industry);
        this.renderRecentActivity(recentActivity);
    }

    updateUserInfo(industry) {
        if (industry) {
            const el = document.getElementById('userIndustry');
            if (el) el.textContent = api.getIndustryName(industry);
        }
    }

    renderRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-title">No recent activity</div>
                    <div class="empty-message">Create your first campaign to get started</div>
                </div>
            `;
            return;
        }

        // Note: onclick handler needs to access the global app instance or we attach listeners later
        // Using window.app.viewCampaign for simplicity in generated HTML
        container.innerHTML = activities.map(activity => `
            <div class="activity-item" onclick="window.app.viewCampaign('${activity.id || ''}')">
                <div class="activity-info">
                    <h4>${api.getIndustryIcon(activity.industry)} ${api.safeString(activity.name, 'Unnamed Campaign')}</h4>
                    <p>${api.formatDateSafe(activity.executedAt)} • ${api.getIndustryName(activity.industry)}</p>
                </div>
                <div class="activity-stats">
                    <div class="leads-count">${api.formatNumber(activity.totalLeads || 0)} leads</div>
                    <div class="priority-count">${api.formatNumber(activity.priorityLeads || 0)} priority</div>
                </div>
            </div>
        `).join('');
    }

    renderCampaigns(campaigns) {
        const container = document.getElementById('campaignsList');
        if (!container) return;

        if (!campaigns || campaigns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <div class="empty-title">No campaigns yet</div>
                    <div class="empty-message">Create your first campaign to start generating leads</div>
                    <button class="btn btn-primary" onclick="window.app.openNewCampaignModal()">Create Campaign</button>
                </div>
            `;
            return;
        }

        container.innerHTML = campaigns.map(campaign => `
            <div class="campaign-card" onclick="window.app.viewCampaign('${campaign.id || ''}')">
                <div class="campaign-header">
                    <div>
                        <div class="campaign-title">
                            ${api.getIndustryIcon(campaign.industry)} ${api.safeString(campaign.name, 'Unnamed Campaign')}
                        </div>
                        <div class="campaign-meta">
                            ${api.formatDateSafe(campaign.executedAt)} • ${api.getIndustryName(campaign.industry)}
                        </div>
                    </div>
                    <div class="campaign-status status-completed">Completed</div>
                </div>
                <div class="campaign-stats">
                    <div class="stat-item">
                        <div class="stat-value">${api.formatNumber(campaign.results?.totalLeads || 0)}</div>
                        <div class="stat-label">Total Leads</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${api.formatNumber(campaign.results?.priorityLeads || 0)}</div>
                        <div class="stat-label">Priority</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${api.parseNumericValue(campaign.results?.averageScore) || '0'}</div>
                        <div class="stat-label">Avg Score</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderLeads(campaign, leads) {
        const container = document.getElementById('leadsTable');
        if (!container) return;

        if (!campaign) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <div class="empty-title">Select a campaign</div>
                    <div class="empty-message">Choose a campaign from the dropdown to view its leads</div>
                </div>
            `;
            return;
        }

        this.leadsTable = new DataTable(container, {
            columns: [
                { key: 'name', title: 'Business Name', sortable: true },
                { key: 'address', title: 'Address', sortable: true },
                { key: 'phone', title: 'Phone', sortable: false },
                { key: 'intelligence.score', title: 'Score', type: 'score', sortable: true },
                { key: 'intelligence.priority', title: 'Priority', type: 'priority', sortable: true },
                { key: 'rating', title: 'Rating', type: 'number', sortable: true },
                { key: 'actions', title: 'Actions', type: 'actions', sortable: false }
            ],
            data: leads || [],
            campaignId: campaign.id,
            pageSize: 20,
            pagination: true,
            sortable: true
        });

        this.leadsTable.render();
    }

    renderAnalytics(analytics) {
        if (!analytics) return;

        // Industry performance chart
        const industryData = Object.entries(analytics.industryStats).map(([industry, stats]) => ({
            label: api.getIndustryName(industry),
            value: stats.totalLeads
        }));

        SimpleChart.createBarChart(
            document.getElementById('industryChart'),
            industryData,
            { title: 'Leads by Industry' }
        );

        // Lead quality distribution
        const qualityData = Object.entries(analytics.qualityDistribution).map(([priority, count]) => ({
            label: `${priority} Priority`,
            value: count
        }));

        SimpleChart.createPieChart(
            document.getElementById('qualityChart'),
            qualityData,
            { title: 'Lead Quality Distribution' }
        );

        // Campaign trends
        const trendsContainer = document.getElementById('trendsChart');
        if (trendsContainer) {
            trendsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; padding: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color);">
                            ${api.formatNumber(analytics.campaignTrends.totalCampaigns)}
                        </div>
                        <div style="color: var(--text-secondary);">Total Campaigns</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--success-color);">
                            ${api.formatNumber(analytics.campaignTrends.totalLeads)}
                        </div>
                        <div style="color: var(--text-secondary);">Total Leads</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--warning-color);">
                            ${analytics.campaignTrends.avgQualityScore}
                        </div>
                        <div style="color: var(--text-secondary);">Avg Quality Score</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color);">
                            ${api.formatNumber(analytics.campaignTrends.recentCampaigns)}
                        </div>
                        <div style="color: var(--text-secondary);">Recent (30 days)</div>
                    </div>
                </div>
            `;
        }
    }

    showCampaignDetail(campaign) {
        // Hide all sections, show detail
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        const detailSection = document.getElementById('campaign-detail');
        if (detailSection) {
            detailSection.classList.add('active');

            // Render details
            this.renderCampaignDetailHeader(campaign);
            this.renderCampaignStats(campaign);
            this.renderCampaignLeadsDetail(campaign);
            this.renderCampaignInsights(campaign);
            this.renderMarketingContent(campaign);
        }
    }

    renderCampaignDetailHeader(campaign) {
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setText('campaignDetailName', campaign.name || 'Unnamed Campaign');
        setText('campaignDetailIndustry', api.getIndustryName(campaign.industry));
        setText('campaignDetailLocation', campaign.location || 'Unknown Location');
        setText('campaignDetailDate', api.formatDateSafe(campaign.executedAt));
    }

    renderCampaignStats(campaign) {
        const results = campaign.results || {};
        const leads = campaign.leads || [];

        // Calculate additional stats
        const totalLeads = results.totalLeads || leads.length || 0;
        const priorityLeads = results.priorityLeads || leads.filter(lead =>
            lead.intelligence?.priority === 'high' || lead.intelligence?.priority === 'medium'
        ).length || 0;

        let averageScore = results.averageScore;
        if (!averageScore) {
            const validScores = leads.map(l => api.parseNumericValue(l.intelligence?.score)).filter(s => s !== null && !isNaN(s));
            averageScore = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : 0;
        }

        let averageRating = 0;
        const validRatings = leads.map(l => api.parseNumericValue(l.rating)).filter(r => r !== null && !isNaN(r));
        averageRating = validRatings.length ? (validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1) : 0;

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setText('detailTotalLeads', api.formatNumber(totalLeads));
        setText('detailPriorityLeads', api.formatNumber(priorityLeads));
        setText('detailAverageScore', api.parseNumericValue(averageScore) || '0');
        setText('detailAverageRating', api.parseNumericValue(averageRating) || '0');
    }

    renderCampaignLeadsDetail(campaign) {
        const container = document.getElementById('campaignLeadsTable');
        if (!container) return;

        if (!campaign.leads || campaign.leads.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <div class="empty-title">No leads found</div>
                    <div class="empty-message">This campaign didn't generate any leads</div>
                </div>
            `;
            return;
        }

        this.detailLeadsTable = new DataTable(container, {
            columns: [
                { key: 'name', title: 'Business Name', sortable: true },
                { key: 'address', title: 'Address', sortable: true },
                { key: 'phone', title: 'Phone', sortable: false },
                { key: 'intelligence.score', title: 'Score', type: 'score', sortable: true },
                { key: 'intelligence.priority', title: 'Priority', type: 'priority', sortable: true },
                { key: 'rating', title: 'Rating', type: 'number', sortable: true },
                { key: 'actions', title: 'Actions', type: 'actions', sortable: false }
            ],
            data: campaign.leads,
            campaignId: campaign.id,
            pageSize: 10,
            pagination: true,
            sortable: true
        });

        this.detailLeadsTable.render();
    }

    renderCampaignInsights(campaign) {
        const leads = campaign.leads || [];
        // ... (Logic for insights calculation and rendering)
        // For brevity, copying logic from dashboard.js
        const priorityStats = {
            high: leads.filter(lead => lead.intelligence?.priority === 'high' || lead.intelligence?.priority === 'HIGH').length,
            medium: leads.filter(lead => lead.intelligence?.priority === 'medium' || lead.intelligence?.priority === 'MEDIUM').length,
            low: leads.filter(lead => lead.intelligence?.priority === 'low' || lead.intelligence?.priority === 'LOW').length
        };

        const totalLeads = leads.length;
        const conversionRate = totalLeads > 0 ? ((priorityStats.high + priorityStats.medium) / totalLeads * 100).toFixed(1) : 0;

        // Approx quality score
        const scoreRanges = {
            high: leads.filter(lead => (lead.intelligence?.score || 0) >= 80).length,
            medium: leads.filter(lead => {
                const score = lead.intelligence?.score || 0;
                return score >= 60 && score < 80;
            }).length,
            low: leads.filter(lead => (lead.intelligence?.score || 0) < 60).length
        };
        const qualityScore = totalLeads > 0 ? ((scoreRanges.high * 3 + scoreRanges.medium * 2 + scoreRanges.low * 1) / (totalLeads * 3) * 100).toFixed(1) : 0;

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setText('insightConversionRate', `${conversionRate}%`);
        setText('insightQualityScore', `${qualityScore}%`);
        setText('insightHighPriority', api.formatNumber(priorityStats.high));
        setText('priorityHigh', api.formatNumber(priorityStats.high));
        setText('priorityMedium', api.formatNumber(priorityStats.medium));
        setText('priorityLow', api.formatNumber(priorityStats.low));

        const setWidth = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = `${val}%`; };
        setWidth('conversionRateBar', conversionRate);
        setWidth('qualityScoreBar', qualityScore);
    }

    renderMarketingContent(campaign) {
        const leads = campaign.leads || [];
        if (leads.length === 0) {
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setText('whatsappContent', 'No leads available.');
            setText('emailContent', 'No leads available.');
            return;
        }

        const sampleLead = leads.find(lead => lead.intelligence?.priority === 'HIGH') || leads[0];

        let whatsappMessage, emailMessage;

        if (sampleLead && sampleLead.intelligence?.marketingContent) {
            const content = sampleLead.intelligence.marketingContent;
            whatsappMessage = content.whatsapp || 'Content not available';
            emailMessage = content.email || 'Content not available';
        } else {
            // Default placeholder content logic
            whatsappMessage = 'Coming soon';
            emailMessage = 'Coming soon';
        }

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('whatsappContent', whatsappMessage);
        setText('emailContent', emailMessage);
    }
}
