# Product Name: Floww 

Product Overview

**Goal:**  
 Build a SaaS platform that automates business operations, supplier invoice management, expense tracking, payment workflows, and end-of-day (EOD) reporting for multi-outlet supermarkets and eateries. The platform leverages AI for OCR, anomaly detection, risk alerts, and actionable business suggestions.

* Centralized, searchable invoice and payment tracking

* Expense management with approvals

* Automated, auditable EOD reporting

* AI-powered anomaly detection (duplicate/over/under payments, missing info, price spikes, supply gaps)

* Price benchmarking and business suggestions

* Multi-user, multi-location, and mobile-first

## **Product Requirements: Core Modules & Tech Stack**

## **1\. Invoice Capture Module**

* **Functionality:**

  * **Users (e.g., Tola Manager, Dami Joe) can upload a photo or scan of an invoice via mobile or web.**

  * **System uses OCR (Google Vision API or Tesseract.js) and basic ML to auto-extract:**

    * **Vendor name**  
    * **Vendor phone number**

    * **Amount**

    * **Description of goods**

    * **Date**

    * **Account number**  
    * **Bank name** 

  * **Extracted fields are pre-filled in the invoice form.**

  * **Manager/uploader can review, correct, or edit any field before saving.**

  * **All images/files stored in cloud storage (Firebase/S3/Supabase Storage).**

* **Database Schema:**

  * **`invoices` table:**

    * **id, vendor\_id,vendor\_number, amount, description, date, account\_number,bank\_name, file\_url, status, created\_by, created\_at, updated\_at**

## **2\. Smart Payment Queue**

* **Functionality:**

  * **Unpaid invoices are grouped by vendor.**

  * **Each invoice displays due date and urgency indicator (e.g.,overdue, due soon).**

  * **Status options: Pending, Partially Paid, Paid, Needs Clarification.**

  * **Users can mark or update payment status.**  
  * **Have outlet specified for admin /owner   dashboard** 

  * **Payment queue is filterable by vendor, date, status, and outlet.**

* **Database Schema:**

  * **`payments` table:**

    * **id, invoice\_id, vendor\_id, amount, status, paid\_at, confirmed\_by**

## **3\. Vendor Profiles**

* **Functionality:**

  * **Each vendor has a profile with:**

    * **Bank details (account name, number, bank)**

    * **History of supplies (all linked invoices)**

    * **Total paid and outstanding amounts (auto-calculated)**

    * **Contact information (phone, email)**

  * **Quick view of payment trends and supply frequency.**

* **Database Schema:**

  * **`vendors` table:**

    * **id, name, account\_name, account\_number, bank\_name, contact, total\_paid, total\_outstanding**

## **4\. Audit Trail**

* **Functionality:**

  * **Every action is auto-logged:**

    * **Who submitted an invoice**

    * **Time of payment confirmation**  
    * **Outlet submitted for users with multiple outlets**

    * **Who approved/edited/marked as paid**

  * **Detects and flags duplicate invoices or payments.**

  * **Ability to generate payment and activity reports by day/week/user/vendor.**

  

  ## 2\. User Personas

* **Managers:** Upload invoices/expenses, approve/reject, run EOD.

* **Owners/Finance:** Review/approve payments, monitor cash flow, view reports, get risk alerts.

* **Staff:** Upload receipts, enter sales, record cash movements.

  ## 3\. Onboarding Flow

**A. Registration**

* Email/phone signup, OTP verification

* Business profile: name, type, locations/outlets, key users

**B. User Invitation**

* Owner invites managers/staff via email/phone

* Assign roles (Owner, Manager, Staff, Finance)

**C. Initial Setup** 

* Add outlets/locations

* Set up expense categories and approval thresholds

* EOD report \- payment types(cash,transfer,POS)

**D. Guided Tour**

* Walkthrough: Uploading invoices, entering expenses, running EOD, viewing dashboards

  ## 4\. App Flows

  A. Invoice & Payment Management  
1. **Invoice Submission**

   * Upload photo/PDF

   * AI OCR extracts: vendor, amount, date, items, account details

2. **Invoice Review**

   * Manager reviews extracted data, set due date and corrects if needed

   * Attach missing info (e.g., account number)  
   * Add outlet name

3. **Approval Workflow**

   * Route to approver (amount, vendor, outlet)

   * Approver receives notification, can approve/reject/comment

4. **Payment Processing**

   * Approved invoices show up in “To Pay” dashboard

   * Owner/Finance marks as paid, enters payment receipt picture (bank, ref, date)

5. **Reconciliation**

   * AI matches payments to invoices, flags duplicates/overlaps/missing info

   * All actions logged for audit

6. **Vendor Ledger**

   * Vendor profile: all invoices, payments, outstanding balances, performance  
   * New invoices gets vendor created and  invoice  pisces compared  with old invoice and flags abrupt price changes based on cost per item 

   B. Expense Management

1. **Expense Submission**

   * Staff uploads receipt/photo or enters expense details

   * AI OCR extracts vendor, amount, date, category

2. **Categorization**

   * AI auto-tags (utilities, repairs, petty cash, etc.)

   * User can override

3. **Approval & Payment**

   * Expenses above threshold routed for approval

   * Approved expenses show in payment dashboard

4. **Expense Analytics**

   * Filter by category, staff, outlet, date

   * Exportable reports

   C. End-of-Day (EOD) Reporting

1. **EOD Prompt**

   * At configured time, staff receive EOD prompt (mobile/web/WhatsApp)

   * Enter sales for the day for different outlet, cash,transfers,POS/Credit card,

2. **Smart Reconciliation**

   * AI matches sales to inventory depletion and cash movements

   * Flags discrepancies (e.g., cash shortfall, sales mismatch)

3. **EOD Summary**

   * EOD report generated: sales, expenses, payments, net profit, cash position

   * Sent to owner/finance via email/WhatsApp can be scheduled

   * Historical EOD reports accessible

   D. AI Anomaly Detection & Suggestions

1. **Anomaly Monitoring**

   * Duplicate/over/under payments

   * Payments to unregistered/personal accounts

   * Price spikes vs. historical/market

   * Supply gaps, urgent reorders

   * EOD mismatches (sales vs. cash vs. stock)

2. **Risk Alerts**

   * Dashboard and push/email/WhatsApp notifications

3. **Business Insights**

   * Suggest price changes based on cost/market/velocity

   * Recommend alternate suppliers

   * Highlight slow-moving/fast-moving items

   * Suggest cost savings (e.g., consolidate vendors)

## **App Flows (with Integration Points)**

1. **Invoice Submission**

   * **User uploads image → OCR/ML auto-extracts data → User reviews/edits → Invoice saved in DB → Audit log created**

2. **Payment Queue**

   * **System groups unpaid invoices by vendor → Shows urgency/due dates → Approver reviews and marks status → Audit log updated**

3. **Vendor Management**

   * **Vendor profile shows all invoices, payment history, contacts, totals → Linked to invoice/payment tables**

4. **Audit Trail & Reports**

   * **Every action logged → Reports generated by user, vendor, date, status → Duplicates and anomalies flagged**

5. **Role-Based Access**

   * **Submitters see/upload/edit their invoices**

   * **Approvers see all, approve/comment, mark as paid**

   5\. Technical Architecture

   A. Supabase Database Schema (Postgres)

   Tables

| Table Name | Key Fields |
| ----- | ----- |
| users | id (PK), name, email, phone, role, business\_id, status, created\_at, last\_login |
| businesses | id (PK), name, type, owner\_id, created\_at |
| outlets | id (PK), business\_id (FK), name, location, manager\_id (FK), status |
| vendors | id (PK), business\_id (FK), name, account\_name, account\_number, bank\_name, contact, rating, created\_at |
| invoices | id (PK), vendor\_id (FK), outlet\_id (FK), amount, invoice\_date, due\_date, status, uploaded\_by, file\_url, extracted\_data (JSON), created\_at, updated\_at |
| payments | id (PK), invoice\_id (FK), amount, paid\_by (FK), paid\_at, bank, ref\_no, status, created\_at |
| expenses | id (PK), outlet\_id (FK), category, amount, expense\_date, description, uploaded\_by, file\_url, status, approved\_by, approved\_at, created\_at |
| eod\_reports | id (PK), outlet\_id (FK), date, sales, cash\_in, cash\_out, expenses\_total, bank\_deposit, notes, submitted\_by, created\_at |
| anomalies | id (PK), type, related\_id, description, detected\_at, resolved, resolved\_by, resolved\_at |
| price\_benchmarks | id (PK), item\_name, vendor\_id (FK), price, date, source, created\_at |
| audit\_logs | id (PK), user\_id (FK), action, entity, entity\_id, timestamp, details (JSON) |

   Supabase Auth

* RBAC: Owner, Manager, Staff, Finance

* Row-level security for multi-tenancy

  Storage  
* Invoice/expense images, PDFs, Excel files stored in Supabase Storage (S3-compatible)

* File URLs referenced in tables

  B. App/Service Architecture  
* **Frontend:** React/Next.js (web), React Native/Flutter (mobile)

* **Backend:** Supabase (Postgres, Auth, Storage, Functions); Node.js serverless functions for AI, integrations

* **AI Services:**

  * OCR (Google Vision, AWS Textract, or open-source Tesseract)

  * Anomaly detection (custom Python/Node microservice, triggered on new data)

  * Price benchmarking (scraping APIs or manual entry)

* **Integrations:**

  * Stripe for subscription after 1 month free trial

  * Open Banking (Mono, Okra, Stitch, or direct bank APIs)

  * Accounting APIs (QuickBooks, Sage, Xero)

  C. Data Flow Example

1. **Invoice Photo Uploaded**

   * Stored in Supabase Storage

   * OCR service extracts data, saves to `invoices` table

   * If fields missing, user prompted to complete

   * Invoice routed for approval, then payment

   * Payment logged, matched, and reconciled

   * AI checks for anomalies, logs to `anomalies` table, triggers alerts

2. **Expense Entry**

   * Receipt/photo uploaded, OCR extracts info

   * Expense categorized, routed for approval if needed

   * Appears in EOD and analytics

3. **EOD Report**

   * Staff enters sales, cash, expenses

   * AI matches with invoices/expenses/payments

   * EOD summary generated, anomalies flagged

   6\. Detailed App Flows

   A. Invoice & Payment Flow

   text

* `graph TD`  
*     `A[Upload Invoice (Web/Mobile/WhatsApp)] --> B[AI OCR Extraction]`  
*     `B --> C[Review/Edit Extracted Data]`  
*     `C --> D[Approval Workflow]`  
*     `D --> E{Approved?}`  
*     `E -- Yes --> F[Add to Payment Dashboard]`  
*     `E -- No --> G[Return for Correction]`  
*     `F --> H[Payment Initiated/Logged]`  
*     `H --> I[AI Reconciliation & Anomaly Check]`  
*     `I --> J[Vendor Ledger Updated]`  
    
  B. Expense Management Flow  
  text  
* `graph TD`  
*     `A[Submit Expense/Receipt] --> B[AI OCR & Categorization]`  
*     `B --> C[Review/Edit]`  
*     `C --> D{Above Approval Threshold?}`  
*     `D -- Yes --> E[Approval Workflow]`  
*     `D -- No --> F[Auto-Approve]`  
*     `E --> G[Add to Expense Ledger]`  
*     `F --> G`  
*     `G --> H[Expense Analytics/EOD]`  
    
  C. EOD Reporting Flow  
  text  
* `graph TD`  
*     `A[EOD Prompt] --> B[Staff Enters Sales/Cash/Expenses]`  
*     `B --> C[AI Reconciliation]`  
*     `C --> D{Discrepancy?}`  
*     `D -- Yes --> E[Flag Anomaly]`  
*     `D -- No --> F[Generate EOD Report]`  
*     `E --> F`  
*     `F --> G[Send to Owner/Finance]`  
    
  D. AI Anomaly/Suggestion Flow  
  text  
* `graph TD`  
*     `A[New Data (Invoice/Expense/Payment/EOD)] --> B[AI Anomaly Engine]`  
*     `B --> C{Anomaly Detected?}`  
*     `C -- Yes --> D[Log Anomaly, Send Alert]`  
*     `C -- No --> E[No Action]`  
*     `D --> F[Owner/Manager Review]`  
*     `F --> G[Resolve/Comment]`  
*     `B --> H[AI Suggestion Engine]`  
*     `H --> I[Business Insights/Price Changes]`  
*     `I --> J[Owner/Manager Review]`  
    
  7\. Integrations & Automation  
* **WhatsApp:**

  * Invoices/receipts forwarded to a dedicated number or email, auto-ingested and processed.

* **Banking:**

  * Payment initiation and reconciliation via Open Banking APIs.

* **Accounting:**

  * Export or sync transactions, expenses, and EOD reports.

* **Notifications:**

  * Email, SMS, WhatsApp for approvals, alerts, EOD summaries, and anomalies.

  8\. Security & Audit

* All actions logged in `audit_logs`

* Role-based access control

* Multi-tenancy enforced at the DB level

* File storage secured with signed URLs

  9\. Roadmap (MVP to V2)  
* **MVP:**

  * Invoice/expense upload, AI OCR, approval workflow, payment tracking, EOD reporting, basic anomaly detection, WhatsApp/email integration.

* **V1:**

  * Bank/accounting integrations, advanced AI suggestions, vendor analytics, mobile app, multi-outlet support.

* **V2:**

  * Inventory integration, price benchmarking automation, vendor portal, advanced reporting, custom AI models.

  10\. Sample User Stories

* As a manager, I can upload an invoice photo and have the system extract all details automatically.

* As an owner, I receive daily EOD reports and anomaly alerts via WhatsApp.

* As a finance user, I approve expenses above a set threshold and see all pending payments in one dashboard.

* As a business, I can benchmark supplier prices and get AI suggestions on price changes and risk alerts.

  11\. Summary Table: Key Features

| Feature | How It Works |
| ----- | ----- |
| Invoice Management | Upload/forward, AI OCR, approval, payment, reconciliation, vendor ledger |
| Expense Management | Upload/enter, AI categorization, approval, analytics |
| EOD Reporting | Staff input, AI reconciliation, summary, anomaly detection |
| Anomaly Detection | AI flags duplicates, missing info, price spikes, supply gaps, risk payments |
| AI Suggestions | Price changes, vendor alternatives, cost-saving, business insights |
| Integrations | WhatsApp, banking, accounting, notifications |


