# Geofenced Google Sheets Attendance System

A lightweight, serverless web application built with Google Apps Script that allows employees to mark their attendance (IN/OUT) within a specific geographic radius. All data is logged directly into a Google Sheet, with automated wage calculations and monthly summaries.

## Features
* **Location-Restricted Punching:** Employees can only mark attendance if they are within a configurable radius (e.g., 100 meters) of the office coordinates.
* **Automated Wage Calculation:** Automatically calculates regular hours, overtime, and total daily wages based on per-employee rates.
* **Zero-Touch Monthly Summaries:** Automatically generates new sheets for each month and compiles a wage summary for the previous month.
* **Device Anomaly Detection:** Flags suspicious punches if an employee suddenly uses a different device to mark attendance.
* **Admin Dashboard (Google Sheets):** Manage active employees and hourly rates directly from an "Employees" sheet—no code changes required.
* **Automated Email Reports:** Emails the finalized monthly attendance and wage report (.xlsx) to the admin on the 1st of every month.

## Tech Stack
* **Backend:** Google Apps Script (`Backend.gs`)
* **Frontend:** HTML, CSS, Vanilla JavaScript (`Frontend.html`)
* **Database:** Google Sheets

## Setup Instructions

### 1. Prepare the Google Sheet
1. Create a new Google Sheet.
2. Copy the long ID from the URL (e.g., `12shhw3V7...`).

### 2. Configure Apps Script
1. Open your Google Sheet and go to **Extensions > Apps Script**.
2. Replace the default code with the contents of `Backend.gs`.
3. Add a new HTML file named `Frontend.html` and paste the frontend code.
4. In `Backend.gs`, update the Configuration section at the top:
   ```javascript
   const GEOFENCE_CENTER = { lat: YOUR_LAT, lng: YOUR_LNG };
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   const ADMIN_EMAIL = 'admin@example.com';
   
### 3. Deploy
1. Click **Deploy** > **New deployment.**
2. Select type: **Web app.**
3. Execute as: **Me.**
4. Who has access: **Anyone** (or restrict to your Google Workspace domain).
5. Click **Deploy** and authorize the script.
6. Open the resulting Web App URL once as the admin. This automatically creates the "Employees" config sheet and installs the necessary background triggers.

### 4. Manage Employees
1. Open your Google Sheet and go to the newly created **Employees** tab.
2. Add your employees' names, hourly rates, and set their status to "Active".
