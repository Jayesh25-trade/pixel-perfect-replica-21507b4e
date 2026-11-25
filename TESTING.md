# Aarav Traders – Two-Phone Live Testing Script

This testing script guides the partners through verifying the mobile application live on two smartphones running simultaneously.

---

## Prerequisites

1. Ensure `supabase/schema.sql` has been executed in the Supabase SQL Editor.
2. Ensure the partner emails have been added to `public.allowed_emails`.
3. Open the production URL on two mobile devices:
   - **Device A:** Partner 1's Phone (e.g., iPhone Safari or Android Chrome)
   - **Device B:** Partner 2's Phone (e.g., Android Chrome)

---

## Test Scenario 1: Authentication & Access Control

### 1.1 Shared Partner Sign-In (Device A)

1. On **Device A**, open the application URL.
2. Enter the shared firm email and password.
3. Tap the eye icon to verify show/hide password toggle.
4. Tap **"Sign in"**.
5. **Expected Result:**
   - User is signed in and redirected to the **Home** dashboard.
   - Header displays the live indicator: green pulsing dot with **"Live"**.
   - No mock or placeholder data is displayed. If no loads exist, the clean empty state is shown: _"No loads recorded yet"_.
   - Session persists across browser restarts.

### 1.2 Invalid Password or Non-Member Rejection (Device B)

1. On **Device B**, test entering an incorrect password.
   - **Expected Result:** Inline error card appears: _"Wrong email or password"_.
2. If signed in as an uninvited user not in `firm_members`:
   - **Expected Result:** App displays the dedicated **"Access Restricted"** screen.
   - Message: _"Your email is not authorized. Ask the partners to add you."_
   - Clear **"Sign Out"** button is present.
   - Database tables return 0 rows under RLS.
3. Tap **"Sign Out"** and sign in with the valid shared partner credentials.

---

## Test Scenario 2: Party Setup

On **Device A**:

1. Tap the **Parties** tab in the bottom navigation bar.
2. Tap the `+` button to add parties:
   - **Supplier:**
     - Name: `Singhal Coal Depot`
     - Type: `Supplier`
     - Phone: `9876543210`
   - **Transport Agency:**
     - Name: `Goyal Roadways`
     - Type: `Transport Agency`
     - Phone: `9876543211`
   - **Buyer:**
     - Name: `Radha Krishna Bricks`
     - Type: `Buyer`
     - Phone: `9876543212`
     - Default Credit Days: `30`
3. **Realtime Verification on Device B:**
   - Switch to **Device B** and tap **Parties**.
   - **Expected Result:** All three newly created parties appear immediately without pulling down to refresh.

---

## Test Scenario 3: Standard Load (TC1 - ₹8,800 Profit)

On **Device A**:

1. Tap **"+"** in the center of the bottom navigation bar to open the **New Load Wizard**.
2. **Step 1 – Purchase:**
   - Date: Today's date
   - Material: `Coal` (18% GST)
   - Supplier: Select `Singhal Coal Depot`
   - Tons Bought: `22.000`
   - Buy Rate (₹/t): `7000`
   - _Formula Preview Check:_
     - Purchase Amount: ₹1,54,000.00
     - GST (18%): ₹27,720.00
     - Total: ₹1,81,720.00
   - Tap **"Next: Truck Details"**.
3. **Step 2 – Truck Details:**
   - Agency: Select `Goyal Roadways`
   - Truck Number: `RJ14-GC-5555`
   - Tons Loaded: Pre-filled with `22.000`
   - Freight Rate (₹/t): `1600`
   - _Formula Preview Check:_
     - Freight Amount: ₹35,200.00 (No GST)
   - Tap **"Next: Sale Details"**.
4. **Step 3 – Sale Details:**
   - Toggle **"Mark as Sold Now"** ON.
   - Buyer: Select `Radha Krishna Bricks`
   - Sale Date: Today's date
   - Tons Received: `22.000`
   - Sale Rate (₹/t): `9000`
   - Credit Days: Pre-filled with `30`
   - _Live Financial Preview Check:_
     - Sale Amount: ₹1,98,000.00
     - Sale GST (18%): ₹35,640.00
     - Sale Total: ₹2,33,640.00
     - Pre-GST Profit: **₹8,800.00**
     - Profit / Ton: **₹400.00 / t**
     - Shortage: **0.000 t**
5. Tap **"Save Load"**.

### Instant Multi-Device Sync Verification:

- Hold **Device B** in hand.
- **Expected Result:** Device B's **Home** and **Loads** screens immediately reflect:
  - 1 Active Load
  - Profit: ₹8,800
  - Pending Receivables: ₹2,33,640
  - Pending Payables: ₹1,81,720 (Supplier) + ₹35,200 (Freight)
  - No page refresh required.

---

## Test Scenario 4: Transit Shortage (TC2 - 21.5 t, ₹4,300 Profit, 0.5 t Shortage)

On **Device B**:

1. Tap **"+"** to record a new load:
   - Material: `Coal`
   - Supplier: `Singhal Coal Depot`
   - Tons Bought: `22.000`
   - Buy Rate: `7000`
   - Agency: `Goyal Roadways`
   - Truck: `RJ14-GC-8888`
   - Tons Loaded: `22.000`
   - Freight Rate: `1600`
   - Mark as Sold: **YES**
   - Buyer: `Radha Krishna Bricks`
   - Tons Received: `21.500` _(0.5 ton lost in transit)_
   - Sale Rate: `9000`
2. **Financial Verification:**
   - Sale Amount: `21.500 × 9000` = **₹1,93,500.00**
   - Shortage Tons: `22.000 - 21.500` = **0.500 t**
   - Profit: `₹1,93,500 - ₹1,54,000 - ₹35,200` = **₹4,300.00**
   - Profit / Ton: `₹4,300 ÷ 21.500` = **₹200.00 / t**
3. Tap **"Save Load"**.
4. Check **Device A**: Device A updates in realtime with the new load and updated totals.

---

## Test Scenario 5: Payment Recording & Overpayment Prevention

On **Device A**:

1. Go to **Loads** and select the first load (`RJ14-GC-5555`).
2. Tap **"Record Payment"**:
   - Kind: `Purchase (to Supplier)`
   - Party: `Singhal Coal Depot`
   - Amount: `₹50,000.00`
   - Mode: `UPI`
   - Reference: `UPI/123456/SBIN`
3. Tap **"Save Payment"**.
   - **Expected Result:** Supplier pending balance drops from ₹1,81,720.00 to ₹1,31,720.00.
   - **Device B** reflects the payment instantaneously.

### Overpayment Rejection Test:

4. Tap **"Record Payment"** again on the same load:
   - Kind: `Purchase (to Supplier)`
   - Amount: `₹1,50,000.00` _(Exceeds remaining ₹1,31,720.00)_
   - Mode: `UPI`
5. Tap **"Save Payment"**.
   - **Expected Result:**
     - The transaction is rejected by the database trigger `trg_validate_payment` executing `public.validate_payment_not_exceeding_bill()`.
     - An error alert appears: _"Payment of ₹150000.00 exceeds remaining bill balance. Bill Total: ₹227720.00, Existing Payments: ₹96000.00, Maximum Allowed: ₹131720.00"_.
     - The invalid payment is not saved.

---

## Test Scenario 6: Reports & Audit Trails

1. On either device, navigate to the **Reports** tab.
2. Select the current month.
3. **Verify Aggregates:**
   - Loads Count: `2`
   - Tons Bought: `44.000 t`
   - Tons Sold: `43.500 t`
   - Shortage: `0.500 t`
   - Total Profit: `₹13,100.00` (₹8,800 + ₹4,300)
   - GST Collected vs GST Paid: Exact GST breakdown matching 18% coal rate.

---

## Partner Live Acceptance Checklist (Fill In On Devices)

| Step / Test Case             | Target / Expected Behavior                                                                        | Actual Value (Fill In On Phone) | Pass / Fail       |
| :--------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------ | :---------------- |
| **1.1 Shared Sign-In**       | Email + password verified; redirects to Home; status dot shows green **"Live"**                   |                                 | [ ] PASS [ ] FAIL |
| **1.2 Invalid / Non-Member** | Wrong password shows inline error; uninvited user shows _"Access Restricted"_ + Sign Out button   |                                 | [ ] PASS [ ] FAIL |
| **2. Party Creation Sync**   | Adding 3 parties on Phone A appears on Phone B instantly without refresh                          |                                 | [ ] PASS [ ] FAIL |
| **3. TC1 Purchase Bill**     | 22 t × ₹7,000 Coal $\rightarrow$ Amount: ₹1,54,000.00; GST (18%): ₹27,720.00; Total: ₹1,81,720.00 |                                 | [ ] PASS [ ] FAIL |
| **3. TC1 Freight Bill**      | 22 t × ₹1,600 $\rightarrow$ Freight Total: ₹35,200.00 (No GST)                                    |                                 | [ ] PASS [ ] FAIL |
| **3. TC1 Sale & Profit**     | 22 t × ₹9,000 $\rightarrow$ Total: ₹2,33,640.00; **Profit: ₹8,800.00** (₹400.00/t)                |                                 | [ ] PASS [ ] FAIL |
| **3. TC1 Realtime Sync**     | Phone B displays the new load and updated totals in $\le 1$ sec                                   |                                 | [ ] PASS [ ] FAIL |
| **4. TC2 Transit Shortage**  | 21.5 t received $\rightarrow$ Sale: ₹1,93,500.00; **Shortage: 0.500 t**; **Profit: ₹4,300.00**    |                                 | [ ] PASS [ ] FAIL |
| **4. TC3 Briquette GST**     | 22 t × ₹7,000 Briquette $\rightarrow$ GST (5%): **₹7,700.00**; Total: ₹1,61,700.00                |                                 | [ ] PASS [ ] FAIL |
| **5. Partial Payment**       | ₹50,000 UPI to Supplier $\rightarrow$ Pending drops to ₹1,31,720.00 on both phones                |                                 | [ ] PASS [ ] FAIL |
| **5. Overpayment Guard**     | Attempting ₹1,50,000 payment rejected with message showing max allowed ₹1,31,720                  |                                 | [ ] PASS [ ] FAIL |
| **6. Monthly Report**        | Month summary aggregates 2 sold loads: 43.5 t sold, 0.5 t shortage, ₹13,100 profit                |                                 | [ ] PASS [ ] FAIL |
| **7. System Check Panel**    | Settings > System Check shows all 11 tables/views present; partner email; version v1.0.1          |                                 | [ ] PASS [ ] FAIL |
