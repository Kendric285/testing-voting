## Local Development

**Requirements:**  
- Node.js v20  
- npm  
- Azure Static Web Apps CLI  
- Azure Functions Core Tools  

### 1. Clone the Repository

```bash
git clone https://github.com/Civic-Engagement-Commission/voting-locations.git
cd voting_locations_protected
```

### 2. Install Node.js Using nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Restart your terminal, then run:
nvm install 20
nvm use 20
nvm alias default 20
```

### 3. Install CLI Tools

```bash
npm install -g @azure/static-web-apps-cli
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### 4. Set Up Backend Configuration

```bash
cd api_functions
```

Create a `local.settings.json` file with the following content (replace `<your_key>` with your actual keys):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AIRTABLE_API_TOKEN": "<your_key>",
    "TRANSLATE_API_KEY": "<your_key>",
    "GEOCODING_API_KEY": "<your_key>",
    "AIRTABLE_BASE_ID": "<your_key>",
    "AIRTABLE_TABLE_ID": "<your_key>",
    "MAX_RECORDS": "400",
    "PAGE_SIZE": "100"
  }
}
```

Then install dependencies:

```bash
npm install
cd ..
```

### 5. Start the App Locally

```bash
swa start ./frontend_app --api-location ./api_functions
```

---

## Azure Deployment

1. Go to [Azure Portal](https://portal.azure.com) and create a new **Static Web App**.
2. Connect it to your GitHub repo.

**Configuration:**

- **App location:** `./frontend_app`
- **API location:** `/api_functions`
- **Output location:** `.`
- **Branch:** `main`

In the Azure Portal, under your Static Web App, go to **Settings → Configuration** and add these application settings (replace `<your_key>` with your actual keys):

```
AIRTABLE_API_TOKEN = <your_key>
TRANSLATE_API_KEY = <your_key>
GEOCODING_API_KEY = <your_key>
AIRTABLE_BASE_ID = <your_key>
AIRTABLE_TABLE_ID = <your_key>
MAX_RECORDS = 400
PAGE_SIZE = 100
```

Push to `main` to trigger a GitHub Actions build and deploy.

---

## Notes

- **Never commit `local.settings.json` or any API keys to Git.**
- If deployment fails, check the GitHub Actions logs in your repo.
- To view runtime errors in production, enable Application Insights in your Azure Static Web App.