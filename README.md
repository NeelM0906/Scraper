# 🚀 Business Leads AI Automation

**The Ultimate B2B Lead Generation & Intelligence Tool**

Turn Google Maps into a powerful source of business intelligence. This tool automates the discovery of local business leads, uses AI to score their quality, and generates personalized marketing campaigns—all from a modern web dashboard.

---

## ✨ Key Features

### 🔍 High-Performance Scraping
- **Grid Search Technology**:Target specific market areas precisely using Zip Code ranges (Start Zip to End Zip).
- **Parallel Batch Processing**: Speed up data collection significantly by running **1 to 5 browser instances** concurrently.
- **Smart Deduplication**: Automatically filters out duplicate businesses to ensure a clean, unique dataset.

### 🧠 AI Lead Intelligence
- **Automatic Scoring**: Uses OpenAI to analyze lead quality (0-100) based on digital presence and completeness.
- **Priority Sorting**: Automatically categorizes leads into **High**, **Medium**, and **Low** priority.
- **Content Generation**: Creates personalized **Email** and **WhatsApp** templates tailored to the lead's industry and specific details.

### 📊 Modern Web Dashboard
- **Campaign Management**: Create, track, and manage multiple campaigns.
- **Rich Analytics**: Visual charts for industry performance and lead quality distribution.
- **Advanced Exporting**: Download data as **CSV** or **vCard** (.vcf) for easy import into your phone or CRM.
- **Dataset Merging**: Combine multiple campaigns into a master list.

---

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd business-leads-ai-automation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

---

## 🚦 Usage

### 1. Start the Dashboard
Launch the web interface:
```bash
npm run web
```
The dashboard will open at `http://localhost:3000`.

### 2. Create a Campaign
1. Click **"➕ New Campaign"**.
2. **Name**: Give your campaign a descriptive name.
3. **Industry**: Select the target industry (e.g., Restaurant, Real Estate, Automotive).
4. **Location Strategy (Grid Mode)**:
   - **Zip Code Range**: Enter the starting and ending zip codes (e.g., `10001` to `10010`).
   - **Batch Size**: Select the number of **Parallel Browsers** (1-5).
     - *Tip: Use 4-5 browsers for maximum speed on powerful machines.*
5. **Search Query**: Refine what you are looking for (e.g., "Italian Restaurant").
6. **Service Description**: Briefly describe what you are selling to help the AI generate relevant pitches.

### 3. Monitor & Export
- Watch the **real-time progress bar** as browsers collect data.
- Once finished, view the **Leads** tab to see AI scores and insights.
- **Generate Report**: comprehensive analysis of your campaign.
- **Export**: Download your leads to CSV or vCard.

---

## ⚖️ Legal & Ethical Usage

**IMPORTANT:** This software is for **educational and legitimate business purposes only**.

Please review the [DISCLAIMER.md](./DISCLAIMER.md) file carefully before use.

- **Respect Rate Limits**: Do not overload Google's servers.
- **Data Privacy**: Ensure compliance with GDPR, CCPA, and local privacy laws.
- **Anti-Spam**: Comply with CAN-SPAM and other regulations when contacting leads.

---

## 🏗️ Tech Stack

- **Runtime**: Node.js
- **Scraping**: Puppeteer (Headless Chrome)
- **AI Engine**: OpenAI GPT-4o / GPT-4 Turbo
- **Frontend**: Vanilla JS, CSS (Responsive Design)
- **Backend**: Express.js
- **Database**: SQLite / JSON Storage

---

*Built for efficiency and intelligence.*