# Smart Asset Manager Portal (AssetManager) User Manual

Version: `v1.0.0-Beta`

This document explains what features exist in the Smart Asset Manager portal and how to use them end-to-end. It is written as a practical user manual for three audiences:

- **End users** (employees): see what assets are assigned to you, report issues, request returns.
- **Support** (IT support): manage tickets and track asset condition.
- **Admins** (IT asset owners): manage inventory, handovers (issuance), stock movements, master data, and user roles.

---

## Table of Contents

1. Quick Start
2. Roles and Access
3. Core Concepts (Assets, Tickets, Issuances, Stock, Maintenance)
4. Navigation and Layout
5. Feature Guide (page-by-page)
6. Common Workflows (step-by-step examples)
7. Status and Field Reference
8. Troubleshooting and Known Limitations

---

## 1. Quick Start

### 1.1 Sign In

The portal supports two login modes:

1. **Company SSO (Azure Entra ID)**
   - Use for real database changes and production usage.
   - Recommended for admins and support teams.
2. **Dev Login (UI testing)**
   - Dev accounts: `admin/123` and `user/123`.
   - Intended for UI testing. Many actions that modify data are blocked or unreliable in this mode.

### 1.2 Sign Out

Use **Sign Out** at the bottom of the sidebar. This clears any local dev session and signs out of the current auth session.

---

## 2. Roles and Access

The portal uses three roles:

- **Admin**
  - Full access: inventory, issuance, tickets, stock history, master data, users, settings.
- **Support**
  - Operational access: dashboard, all assets, tickets, and my assets.
- **User**
  - Self-service access: my assets (assigned devices and personal ticket history).

### 2.1 Menu Items by Role (Sidebar)

- **Dashboard**: admin, support
- **My Assets**: user, admin, support
- **All Assets**: admin, support
- **Issuance**: admin
- **Tickets**: admin, support
- **Users**: admin
- **Stock History**: admin
- **Data Management**: admin
- **Settings**: admin

If you do not see an item in the sidebar, your role does not include it.

---

## 3. Core Concepts

This section defines the objects you manage in the portal.

### 3.1 Assets

An **Asset** represents a physical device (laptop, printer, barcode scanner, phone, etc).

Important fields as seen in the UI:

- **Company**: e.g. `Dell`, `Lenovo`, `Zebra`
- **Model**: e.g. `Latitude 7420`, `ThinkPad T14`, `TC52`
- **Category**: e.g. `laptop`, `printer`, `scanner`
- **Department**: e.g. `IT`, `Accounts`, `HR` (configured in Data Management)
- **Warranty Start / End / Vendor**
- **Asset ID** (also shown as Serial Number in some places)
  - Example format: `KTPL-L01`, `KTPL-P01`, `KTPL-M01`

#### Asset Status (Inventory State)

- `available` (shown as **IT Stock**): in IT inventory and available to issue
- `issued` (shown as **Issued**): currently assigned to someone
- `maintenance` (shown as **Maintenance**): not available; under repair/maintenance
- `returned` (treated as **IT Stock** in UI)

### 3.2 Issuance (Handover / Return Records)

An **Issuance** record represents handing an asset to a user (active issuance), and returning it later.

- **Active issuance**: status `active` (asset is currently issued)
- **Returned issuance**: status `returned` with a return date

Issuance is what drives assignment in the system.

### 3.3 Tickets (Support Requests)

Tickets are stored using the same data store as issuance records, and are identified by a status that starts with `ticket_`.

Ticket statuses:

- `ticket_open`
- `ticket_in-progress`
- `ticket_resolved`
- `ticket_return` (return/handover request)

Ticket priority:

- `low`
- `medium`
- `high`

### 3.4 Stock History (Stock Transactions)

Every stock movement creates a **stock transaction**:

- **IN**: asset added or returned to stock
- **OUT**: asset issued, deleted, or moved out

Stock transactions support:

- Category
- Vendor
- Item name (for general stock entries not tied to a specific asset)
- Quantity
- Note / Reason

### 3.5 Maintenance History

Maintenance logs record:

- Repairs and maintenance work
- Assignment events (issued/returned)
- Ticket resolution events (auto-logged when a ticket is resolved)

This is the â€œpaper trailâ€ for each asset.

---

## 4. Navigation and Layout

### 4.1 Sidebar

The left sidebar is role-based. It includes:

- Module navigation (pages)
- App version badge (`v1.0.0-Beta`)
- Sign Out

### 4.2 Page Layout

Most pages follow the same pattern:

- Page title + short description
- Filter/search toolbar (where applicable)
- Main table or cards
- Dialogs for create/edit actions

---

## 5. Feature Guide (Page-by-Page)

### 5.1 Dashboard (Admin / Support)

Purpose: High-level monitoring of inventory and support load.

What you see:

- **Summary stats**
  - Total assets
  - Issued assets
  - Available assets
  - Open tickets
  - Repair tickets (hardware tickets that are not resolved)
- **Recent issuances**
  - Recently issued/returned actions (latest events)
- **Quick actions**
  - â€œIssue New Assetâ€ navigates to Issuance
  - â€œAdd New Stockâ€ navigates to Assets (inventory operations)
- **AI Insights tab**
  - A rule-based insight feed derived from tickets, maintenance logs, and warranty dates.

AI Insights rules (current behavior):

1. Recurring issue: same category appears `2+` times in `90` days for an asset.
2. Model risk: a model has `3+` tickets in `90` days.
3. Warranty: a ticket date is before the assetâ€™s warranty end date.
4. Replace recommendation: `3+` major repairs (screen, battery, motherboard, keyboard).

### 5.2 My Assets (User / Admin / Support)

Purpose: Self-service view of what is assigned to you plus your ticket history.

Tabs:

1. **Assets**
   - Lists devices assigned to you.
2. **Tickets**
   - Shows your ticket history and status (including IT resolution notes when resolved).

Actions:

- **Report Issue**
  - Opens a form where you choose:
    - Issue type: hardware / software
    - Sub-category (pre-defined list)
    - Priority: low / medium / high
    - Description
  - Submitting creates a new ticket in the system.

- **Return**
  - Submits a return request (`ticket_return`) for an asset.
  - IT/admin can then manage it from the Tickets module and/or process the return via Issuance.

Notes:

- If you are using Dev Login, ticket submission may be blocked (Dev Login is for UI testing, not real ticket creation).

### 5.3 All Assets (Admin / Support)

Purpose: Full hardware inventory management.

Main capabilities:

1. **View inventory**
   - Table columns include: Company, Model, Category, Department, Warranty End, Asset ID, Status, Assigned To.
2. **Search**
   - Searches by asset name and Asset ID.
3. **Filters**
   - Filter by Category and Status.
4. **Category tabs**
   - â€œAll Assetsâ€
   - One tab per category (from Data Management categories)
   - â€œDepartmentsâ€ tab
5. **Advanced filters for Laptop/Mobile categories**
   - Processor (CPU)
   - RAM
   - Storage
   - Company
   - Model
6. **Add Asset**
   - Creates a new asset with status `available` (IT Stock).
   - If Asset ID is blank, an ID is auto-generated:
     - Example: `KTPL-L01` (Laptop), `KTPL-P01` (Printer), `KTPL-M01` (Mobile), `KTPL-B01` (Barcode/Scanner)
7. **Edit Asset (Admin only)**
   - Update category, Asset ID, status, company/model, department, warranty, and notes/config.
8. **Asset History**
   - Opens the asset history dialog (maintenance + ticket timeline).
9. **Delete Asset (Admin only)**
   - Deletes the asset record and logs a stock OUT transaction.
10. **Bulk Import (Excel)**
   - Upload `.xlsx/.xls`
   - Map your Excel columns to asset fields
   - Import creates assets as `available` and logs a â€œBulk importâ€ stock IN transaction for each.

Dev Login limitations:

- Add/Edit/Delete/Import are blocked or read-only in Dev Login.

### 5.4 Issuance (Admin)

Purpose: Manage device handovers and returns.

Issuing a device:

1. Click **New Issuance**
2. Select an available asset
3. Enter employee name and email
4. Submit

What the system does automatically:

- Creates an issuance record with status `active`
- Updates the asset status to `issued`
- Creates a stock OUT transaction (â€œIssued to â€¦â€)
- Adds a maintenance log entry (â€œIssued to â€¦â€)
- Sends an email to the employee confirming handover details

Returning a device:

- Click **Mark Returned** for an active issuance
- System updates:
  - issuance status -> `returned` + return date
  - asset status -> `available`
  - stock IN transaction (â€œReturned by â€¦â€)
  - maintenance log entry (â€œReturned by â€¦â€)

Deleting an issuance:

- Deletes the issuance record (confirmation required).

### 5.5 Tickets (Admin / Support)

Purpose: IT support queue and ticket lifecycle management.

What you can do:

- View all tickets (open, in-progress, resolved, return requests)
- Filter by status
- Open a ticketâ€™s **Manage** dialog
- Update status:
  - Open
  - In Progress
  - Resolved
- Add a **Resolution Note**
  - Notes are visible to the user in their ticket history

Automatic maintenance logging:

- When a ticket is marked `ticket_resolved`, the system attempts to create a maintenance log:
  - Type: `issue`
  - Description: â€œResolved ticket: â€¦ Note: â€¦â€

Known limitation (current build):

- The search input is present in the UI but does not filter results yet.

### 5.6 Stock History (Admin)

Purpose: Inventory movements and general stock in/out logging.

What you can do:

- View stock transactions (IN/OUT) with:
  - Asset / Item name
  - Category
  - Vendor
  - Quantity
  - Date
  - Note / Reason
- Add a new log entry:
  - Choose Category and Vendor
  - Either select an Asset or enter an Item Name (for general stock)
  - Choose Stock In or Stock Out
  - Enter quantity and optional note

Tip:

- Use â€œItem Nameâ€ for consumables or bulk items that are not tracked as individual assets.

### 5.7 Data Management (Admin)

Purpose: Master data used by other modules.

Sections:

1. **Category Management**
   - Add a new asset category (name + icon)
   - Remove categories
   - Categories feed:
     - Asset category dropdowns
     - Asset tabs
     - Serial/Asset ID auto-generation prefixes

2. **Department Management**
   - Add/remove department names
   - Used when creating/updating assets

3. **Vendor Management**
   - Add/remove vendor names
   - Used in Stock History logging

If the backend categories API is unavailable:

- The portal automatically falls back to local storage mode for categories so you can keep working in the UI.

### 5.8 Users (Admin)

Purpose: User access control (roles).

Capabilities:

- View user list
- Change role (admin/user)
- If the backend users API is unavailable:
  - The portal can display cached users and store role changes locally.

### 5.9 Settings (Admin)

Purpose: Profile and notification configuration.

Current sections:

- Profile Information (name, email, avatar placeholder)
- Notifications (email notifications toggle)

Known limitation (current build):

- Additional tabs like Security and Regional exist in the UI but are not yet implemented.

---

## 6. Common Workflows (Step-by-Step Examples)

### Workflow A: Add a New Device to Inventory (Admin)

Goal: Add a new laptop into IT stock.

1. Go to **All Assets**
2. Click **Add Asset**
3. Fill:
   - Company: `Dell`
   - Model: `Latitude 7420`
   - Department: `IT` (or the owning department)
   - Warranty Start: `2026-01-15`
   - Warranty End: `2029-01-15`
   - Warranty Vendor: `Dell`
   - Category: `Laptop`
   - Asset ID: leave blank (auto-generate `KTPL-Lxx`)
   - System Configuration: `Core i7, 16GB RAM, 512GB SSD`
4. Click **Save Asset**

Result:

- Asset is created with status **IT Stock**
- A Stock History IN record is created (â€œNew asset addedâ€)

### Workflow B: Bulk Import Inventory from Excel (Admin)

Goal: Import many assets at once.

1. Go to **All Assets**
2. Click **Bulk Import**
3. Select your `.xlsx` file
4. In â€œMap Excel Columnsâ€:
   - Map at least **Asset Model (Required)**
   - Optionally map Asset ID, Department, Warranty, Processor/RAM/Storage, etc.
5. Click **Import**

Result:

- Each row becomes an asset
- Stock History logs an IN entry per imported asset (â€œBulk importâ€)

### Workflow C: Issue a Device to an Employee (Admin)

1. Go to **Issuance**
2. Click **New Issuance**
3. Select an available asset
4. Enter:
   - User Name: `John Doe`
   - User Email: `john.doe@company.com`
5. Submit

Result:

- Asset becomes **Issued**
- Stock OUT transaction created
- Maintenance assignment log created
- Email sent to the user confirming the handover

### Workflow D: User Reports an Issue (User)

1. Go to **My Assets**
2. Find the device
3. Click **Report Issue**
4. Choose:
   - Issue Type: Hardware
   - Category: Battery/Power
   - Priority: High
   - Description: â€œBattery drains in 45 minutes even after full charge.â€
5. Submit

Result:

- Ticket is created with status **Open**
- IT can manage it from **Tickets**

### Workflow E: Resolve a Ticket (Support/Admin)

1. Go to **Tickets**
2. Find the ticket (filter by Open/In Progress)
3. Click **Manage**
4. Add Resolution Note:
   - Example: â€œReplaced battery, updated BIOS, verified charge cycle.â€
5. Click **Resolved**

Result:

- Ticket status becomes Resolved
- A maintenance log entry is created automatically for the asset (best-effort)
- User sees the resolution note in their My Assets ticket history

### Workflow F: Return a Device (Admin)

1. Go to **Issuance**
2. Find the active issuance
3. Click **Mark Returned**

Result:

- Issuance status becomes Returned
- Asset becomes IT Stock again
- Stock IN transaction created
- Maintenance assignment log created (â€œReturned by â€¦â€)

---

## 7. Status and Field Reference

### 7.1 Asset Status

- **IT Stock**: `available` (also `returned`)
- **Issued**: `issued`
- **Maintenance**: `maintenance`

### 7.2 Ticket Status

- **Open**: `ticket_open`
- **In Progress**: `ticket_in-progress`
- **Resolved**: `ticket_resolved`
- **Return Request**: `ticket_return`

### 7.3 Stock Transaction Type

- **IN**: `in`
- **OUT**: `out`

### 7.4 IDs (Important)

You may see two kinds of identifiers:

- **Asset record ID** (internal): used by the database to link issuances, stock transactions, and maintenance to an asset.
- **Asset ID** (human-friendly): shown in UI as â€œAsset IDâ€ or serial (e.g. `KTPL-L01`).

If a screen shows an ID that looks long or random, it may be the internal asset record ID.

---

## 8. Troubleshooting and Known Limitations

### 8.1 â€œ500 Internal Server Errorâ€ on categories/users

Cause:

- Backend database API is failing for the table endpoint (server-side error).

What the portal does:

- Categories automatically switch to **local storage mode** so you can still add/delete categories in the UI.
- Users/roles can also fall back to cached values (limited).

What to do:

- Confirm backend API auth keys are configured.
- Check SQL Server schema exists for:
  - `categories`
  - `users`
  - `assets`
  - `issuances`
  - `maintenance`
  - `stockTransactions`
- Try again after backend is healthy to persist changes centrally.

### 8.2 Dev Login â€œread-onlyâ€ warnings

Dev Login is meant for UI testing. If you need real data persistence, use **Sign in with Company SSO**.

### 8.3 Ticket search not filtering

The Tickets page includes a search input, but it does not filter tickets yet in the current build.

---

If you want, I can also generate an **Admin SOP** (operational checklist) and a shorter **End-User Quick Guide** derived from this manual.

