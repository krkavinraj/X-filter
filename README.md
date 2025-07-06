# X-Filter: AI-Powered Twitter/X Feed Filter

This Chrome extension allows you to filter your Twitter/X timeline in real-time using custom, natural-language rules powered by Azure OpenAI GPT-4o.

## Features

- **Custom Filtering**: Define your own rules for what to see (e.g., "*Show me tweets about AI and machine learning*") or what to hide (e.g., "*Don't show me political content*").
- **Real-Time**: The filter applies automatically as you scroll through your feed.
- **Non-Destructive**: Filtered tweets are replaced with a placeholder and can be viewed with a single click.
- **Toggle On/Off**: Easily enable or disable filtering from the extension popup.

## Project Structure

- `/backend`: The FastAPI server that processes tweets with Azure OpenAI.
- `/extension`: The Chrome extension source code (HTML, CSS, JavaScript).

---

## Local Development Setup

### 1. Backend Server

- **Navigate to the backend directory**:
  ```bash
  cd backend
  ```
- **Install dependencies**:
  ```bash
  pip install -r requirements.txt
  ```
- **Create a `.env` file** and add your Azure OpenAI credentials:
  ```
  AZURE_OPENAI_ENDPOINT="https://YOUR_AZURE_RESOURCE.openai.azure.com/"
  AZURE_OPENAI_API_KEY="YOUR_API_KEY"
  AZURE_OPENAI_API_VERSION="2024-02-01"
  AZURE_OPENAI_DEPLOYMENT_NAME="YOUR_DEPLOYMENT_NAME"
  ```
- **Run the server**:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port 8000
  ```

### 2. Chrome Extension

- Open Chrome and navigate to `chrome://extensions`.
- Enable **Developer mode**.
- Click **Load unpacked** and select the `/extension` folder from this project.
- The extension icon will appear in your toolbar. Make sure the `BACKEND_URL` in `extension/content.js` is pointing to `http://localhost:8000/api/filter-tweets`.

---

## Deployment Guide

### Part 1: Deploying the Backend

We'll use Render for a free and easy deployment.

1.  **Push to GitHub**: Make sure your project (both `backend` and `extension` folders) is in a GitHub repository.

2.  **Create a Render Account**: Sign up at [render.com](https://render.com/) using your GitHub account.

3.  **Create a New Web Service**:
    - In the Render dashboard, click **New +** > **Web Service**.
    - Connect your GitHub repository.
    - In the settings:
        - **Name**: Give your service a name (e.g., `x-filter-backend`).
        - **Root Directory**: `backend` (This tells Render to run commands from this subfolder).
        - **Runtime**: `Python 3`.
        - **Build Command**: `pip install -r requirements.txt`.
        - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port 10000`.

4.  **Add Environment Variables**:
    - Go to the **Environment** tab for your new service.
    - Add the same four `AZURE_OPENAI_*` variables from your `.env` file.

5.  **Deploy**: Click **Create Web Service**. Render will build and deploy your app. Once it's live, you will get a public URL (e.g., `https://x-filter-backend.onrender.com`).

### Part 2: Updating and Packaging the Extension

1.  **Update the Backend URL**:
    - Open `extension/content.js`.
    - Change the `BACKEND_URL` constant to your new public URL from Render. Make sure to include the full path: `https://YOUR_RENDER_APP_NAME.onrender.com/api/filter-tweets`.

2.  **Distribute the Extension**:
    - **Option A: Chrome Web Store (Recommended)**
        - Create a `.zip` file containing all the files inside the `/extension` folder.
        - Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/) and pay the one-time $5 registration fee.
        - Upload your `.zip` file, fill out the store listing details, and submit for review.
    - **Option B: Manual Sharing**
        - Create a `.zip` file of the `/extension` folder and share it directly with users.
        - They will need to follow the same "Load unpacked" steps from the local development guide.

2.  **Create a Python virtual environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create a `.env` file**: Copy the `.env.example` to a new file named `.env`.
    ```bash
    cp .env.example .env
    ```

5.  **Edit the `.env` file**: Open `.env` and fill in your Azure credentials from Step 1.
    ```
    AZURE_OPENAI_ENDPOINT="YOUR_AZURE_OPENAI_ENDPOINT"
    AZURE_OPENAI_API_KEY="YOUR_AZURE_OPENAI_API_KEY"
    AZURE_OPENAI_DEPLOYMENT_NAME="YOUR_GPT4O_DEPLOYMENT_NAME"
    ```

6.  **Run the FastAPI server**:
    ```bash
    uvicorn main:app --reload
    ```
    The backend will be running at `http://localhost:8000`.

### 3. (Optional) Deploy to Azure App Service

For a persistent setup, you can deploy the FastAPI app to Azure App Service. You can follow the [official guide for deploying a Python app](https://docs.microsoft.com/azure/app-service/quickstart-python).

---

## 🔧 Part 2: Chrome Extension Setup

### 1. Configure the Backend URL

1.  Open the extension's content script: `/Users/kavinraj/X-filter/extension/content.js`.
2.  On line 3, change the `BACKEND_URL` constant from the local development URL to your deployed backend URL if you deployed it.
    ```javascript
    // IMPORTANT: Replace with your deployed backend URL
    const BACKEND_URL = 'http://localhost:8000/api/filter-tweets'; // Or your deployed URL
    ```

### 2. Install the Extension in Chrome

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **"Developer mode"** using the toggle in the top-right corner.
3.  Click the **"Load unpacked"** button.
4.  Select the `/Users/kavinraj/X-filter/extension` directory.
5.  The "X Startup Filter" extension should now appear in your list of extensions.

---

## 🚀 How to Use

1.  Make sure your backend server is running (either locally or deployed).
2.  Navigate to `https://twitter.com` or `https://x.com`.
3.  Click the puzzle piece icon in your Chrome toolbar to see your extensions.
4.  Click on "X Startup Filter" to open the popup.
5.  Use the toggle to enable or disable the "Filter Startup Feed".

When enabled, the extension will automatically scan new tweets on your timeline and hide the ones that are not related to startups or tech. You should see a console log from the extension in the browser's developer tools indicating its activity.