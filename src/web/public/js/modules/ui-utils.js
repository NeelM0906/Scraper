import { api } from './api.js';

// Notification System
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notifications');
        this.notifications = new Map();
        this.nextId = 1;

        if (!this.container) {
            console.error('Notification container #notifications not found');
        }
    }

    show(title, message, type = 'info', duration = 5000) {
        if (!this.container) return;

        const id = this.nextId++;
        const notification = this.createNotification(id, title, message, type);

        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }

        return id;
    }

    createNotification(id, title, message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <h4 class="notification-title">${title}</h4>
                <button class="notification-close" data-id="${id}">&times;</button>
            </div>
            <p class="notification-message">${message}</p>
        `;

        // Add event listener for close button
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.remove(id));
        }

        return notification;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.style.animation = 'notificationSlideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications.delete(id);
            }, 300);
        }
    }

    clear() {
        this.notifications.forEach((notification, id) => {
            this.remove(id);
        });
    }
}

// Modal Manager
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });

        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && this.activeModal) {
                this.close();
            }
        });
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modal;
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal = null;
            document.body.style.overflow = '';
        }
    }
}

export const notificationManager = new NotificationManager();
export const modalManager = new ModalManager();

// Progress Manager for campaign tracking
export class ProgressManager {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.nameElement = document.getElementById('progressCampaignName');
        this.statusElement = document.getElementById('progressStatus');
        this.progressBar = document.getElementById('progressBar');
        this.progressPercent = document.getElementById('progressPercent');
        this.messagesContainer = document.getElementById('progressMessages');
        this.closeButton = document.getElementById('progressCloseBtn');
        this.messages = [];
    }

    show(campaignName) {
        if (this.nameElement) this.nameElement.textContent = campaignName;
        if (this.statusElement) this.statusElement.textContent = 'Starting campaign...';
        this.updateProgress(0);
        this.messages = [];
        if (this.messagesContainer) this.messagesContainer.innerHTML = '';
        if (this.closeButton) this.closeButton.disabled = true;
        if (this.modal) modalManager.open(this.modal.id);
    }

    updateProgress(percentage, status = null) {
        if (this.progressBar) this.progressBar.style.width = `${percentage}%`;
        if (this.progressPercent) this.progressPercent.textContent = `${Math.round(percentage)}%`;

        if (status) {
            if (this.statusElement) this.statusElement.textContent = status;
            this.addMessage(status, 'info');
        }

        if (percentage >= 100 && this.closeButton) {
            this.closeButton.disabled = false;
        }
    }

    addMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const messageElement = document.createElement('div');
        messageElement.className = `progress-message ${type}`;
        messageElement.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="message">${message}</span>
        `;

        if (this.messagesContainer) {
            this.messagesContainer.appendChild(messageElement);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }

        this.messages.push({ timestamp, message, type });
    }

    complete(results) {
        this.updateProgress(100, 'Campaign completed successfully!');
        this.addMessage(`Generated ${results.totalLeads} leads with ${results.priorityLeads} priority prospects`, 'success');
        if (this.closeButton) this.closeButton.disabled = false;
    }

    error(errorMessage) {
        this.addMessage(`Error: ${errorMessage}`, 'error');
        if (this.statusElement) this.statusElement.textContent = 'Campaign failed';
        if (this.closeButton) this.closeButton.disabled = false;
    }

    hide() {
        modalManager.close();
    }
}
