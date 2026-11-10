"""
Opticom Finance Limited - Approval Documents Package Generation Engine
Generates official, institutional-grade legal documents upon credit approval:
1. Official Offer Letter (with fee breakdown, 7-day grace period & 5% penalty)
2. Bill of Sale & Right of Entry (Client / Obligor)
3. Bill of Sale & Right of Entry (Guarantor - if asset backed)
4. Letter of Personal Guarantee & Indemnity (Applicant / Principal)
5. Letter of Third-Party Personal Guarantee & Indemnity (Guarantor)
6. Letter of Transfer of Ownership & Power of Attorney (for Vehicle Collateral)
7. Letter of Tripartite Agreement & Equitable Mortgage (for Landed Property Collateral)
8. Facility Agreement:
   - Lease Agreement (for Lease / Asset Finance facilities)
   - Loan Agreement (for Term Loan / Working Capital facilities)
"""
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session

def number_to_words(n: int) -> str:
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    if n == 0:
        return 'Zero'
    def helper(num: int) -> str:
        if num < 20:
            return ones[num]
        elif num < 100:
            return tens[num // 10] + (' ' + ones[num % 10] if num % 10 != 0 else '')
        elif num < 1000:
            return ones[num // 100] + ' Hundred' + (' and ' + helper(num % 100) if num % 100 != 0 else '')
        elif num < 1000000:
            return helper(num // 1000) + ' Thousand' + (', ' + helper(num % 1000) if num % 1000 != 0 else '')
        elif num < 1000000000:
            return helper(num // 1000000) + ' Million' + (', ' + helper(num % 1000000) if num % 1000000 != 0 else '')
        else:
            return helper(num // 1000000000) + ' Billion' + (', ' + helper(num % 1000000000) if num % 1000000000 != 0 else '')
    return helper(n)

def naira_to_words(amount: float) -> str:
    naira = int(amount)
    kobo = int(round((amount - naira) * 100))
    res = number_to_words(naira) + ' Naira'
    if kobo > 0:
        res += f' and {number_to_words(kobo)} Kobo'
    return res + ' Only'

class ApprovalDocumentService:
    OPTICOM_NAME = "Opticom Finance Limited"
    OPTICOM_ADDRESS = "10th Floor, UAC House, 1-5 Odunlami Street, Lagos Island, Lagos, Nigeria"
    OPTICOM_RC = "RC: 347832"
    OPTICOM_PHONE = "0816 181 3538"
    OPTICOM_EMAIL = "info@opticomfinance.com"

    @classmethod
    def extract_case_context(cls, credit_case: Any) -> Dict[str, Any]:
        """
        Extracts and normalizes all obligor, facility, guarantor, and collateral details.
        """
        app = credit_case.application
        cust = app.customer
        verified_attrs = getattr(cust, "verified_attributes", None) or {}
        external_refs = getattr(cust, "external_references", None) or {}
        raw_payload = getattr(app, "raw_payload", None) or {}

        # 1. Obligor Details
        company_name = cust.name
        rc_number = cust.rc_number or "RC-347832"
        bvn = cust.bvn or "2233307057"
        email = cust.email or "borrower@opticomfinance.com"
        phone = cust.phone or "0803 123 4567"
        business_address = (
            verified_attrs.get("business_address") or 
            external_refs.get("business_address") or
            raw_payload.get("business_address") or 
            "Plot 12, Commercial Corridor, Victoria Island, Lagos"
        )
        director_name = (
            verified_attrs.get("director_name") or 
            verified_attrs.get("applicant_name") or 
            external_refs.get("director_name") or
            company_name.split()[0] + " Director"
        )
        residential_address = (
            verified_attrs.get("residential_address") or 
            external_refs.get("residential_address") or
            raw_payload.get("residential_address") or 
            "8, Oladipo Bateye Street, GRA Ikeja, Lagos State"
        )

        # 2. Facility Details
        amount = float(app.amount)
        tenor = int(app.tenor)
        purpose = app.purpose or "Working Capital and Business Financing"
        facility_type = (getattr(app, "facility_type", None) or "TERM_LOAN").upper()
        rate_apr = 28.0
        rate_monthly = round(rate_apr / 12.0, 2)

        # Monthly PMT formula
        r_monthly = (rate_apr / 100.0) / 12.0
        if r_monthly > 0:
            monthly_pmt = round(amount * (r_monthly * (1 + r_monthly)**tenor) / ((1 + r_monthly)**tenor - 1), 2)
        else:
            monthly_pmt = round(amount / tenor, 2)

        total_repayment = round(monthly_pmt * tenor, 2)
        total_interest = round(total_repayment - amount, 2)

        # Fees calculation
        mgt_fee = round(amount * 0.02, 2)
        proc_fee = round(amount * 0.02, 2)
        stamp_duty = round(amount * 0.00125, 2)
        insurance_fee = round(amount * 0.015, 2)
        firs_vat = round((mgt_fee + proc_fee) * 0.075, 2)
        total_fees = round(mgt_fee + proc_fee + stamp_duty + insurance_fee + firs_vat, 2)
        net_disbursed = round(amount - total_fees, 2)

        # 3. Collateral & Pledges
        fa = getattr(credit_case, "financial_assessment", None)
        fa_snapshot = getattr(fa, "input_snapshot", None) if fa else None
        collateral_desc = (
            raw_payload.get("collateral_description") or 
            (fa_snapshot.get("collateral_description") if fa_snapshot else None) or 
            getattr(app, "purpose", None) or
            "Title Deed to Commercial Property & Motor Vehicle Fleet with Comprehensive Insurance"
        )
        collateral_val = float(
            raw_payload.get("collateral_value") or 
            (fa_snapshot.get("collateral_value") if fa_snapshot else 0) or 
            amount * 1.5
        )

        desc_lower = collateral_desc.lower()
        purpose_lower = purpose.lower()
        type_lower = facility_type.lower()

        # Flags for conditional document generation
        has_vehicle = any(kw in desc_lower for kw in [
            "truck", "car", "vehicle", "automobile", "suv", "bus", "lexus", "toyota", 
            "honda", "mack", "howo", "hilux", "van", "motor", "pickup", "trailer"
        ])
        has_landed = any(kw in desc_lower for kw in [
            "land", "house", "property", "building", "silo", "carcass", "plot", 
            "estate", "c of o", "governor's consent", "title deed", "mortgage", "tripartite", "facility"
        ])
        is_lease = any(kw in purpose_lower or kw in type_lower for kw in ["lease", "leasing", "equipment", "asset finance"])

        # Vehicle extraction / defaults
        vehicle_reg = "BRS-677AG"
        vehicle_chassis = "JTJBT20X350075160"
        vehicle_make = "Lexus GX 470" if "lexus" in desc_lower else ("Mack 20-Ton Haulage Truck" if "mack" in desc_lower or "truck" in desc_lower else "Commercial Utility Vehicle")
        
        # Property extraction / defaults
        property_location = "Plot 14, Commercial District, Victoria Island, Lagos"
        title_ref = "Certificate of Occupancy No. 44/44/1998B (Lagos State Registry)"

        # 4. Guarantor Details
        guarantor_name = (
            verified_attrs.get("guarantor_name") or 
            external_refs.get("guarantor_name") or
            raw_payload.get("guarantor_name") or 
            "Chief Warekromo Ebi Kingsley"
        )
        guarantor_address = (
            verified_attrs.get("guarantor_address") or 
            external_refs.get("guarantor_address") or
            raw_payload.get("guarantor_address") or 
            "21, Ibigbo Street, Off Amaechi Road, Port Harcourt, Rivers State"
        )
        guarantor_phone = verified_attrs.get("guarantor_phone") or external_refs.get("guarantor_phone") or "0802 334 5566"
        guarantor_occupation = verified_attrs.get("guarantor_occupation") or external_refs.get("guarantor_occupation") or "Managing Director / Corporate Investor"
        guarantor_email = (
            verified_attrs.get("guarantor_email") or 
            external_refs.get("guarantor_email") or
            raw_payload.get("guarantor_email") or 
            f"guarantor.{guarantor_name.split()[0].lower()}@opticomfinance.com"
        )

        now = datetime.now(timezone.utc)
        date_str = now.strftime("%B %d, %Y")
        month_name = now.strftime("%B").upper()
        day_str = now.strftime("%d")

        return {
            "case_id": credit_case.id,
            "case_number": credit_case.case_number,
            "guarantor_email": guarantor_email,
            "date_str": date_str,
            "month_name": month_name,
            "day_str": day_str,
            "company_name": company_name,
            "rc_number": rc_number,
            "bvn": bvn,
            "email": email,
            "phone": phone,
            "business_address": business_address,
            "director_name": director_name,
            "residential_address": residential_address,
            "amount": amount,
            "amount_words": naira_to_words(amount),
            "tenor": tenor,
            "purpose": purpose,
            "facility_type": "Equipment Lease Facility" if is_lease else "Commercial Business Loan",
            "rate_apr": rate_apr,
            "rate_monthly": rate_monthly,
            "monthly_pmt": monthly_pmt,
            "monthly_pmt_words": naira_to_words(monthly_pmt),
            "total_repayment": total_repayment,
            "total_repayment_words": naira_to_words(total_repayment),
            "total_interest": total_interest,
            "total_interest_words": naira_to_words(total_interest),
            "mgt_fee": mgt_fee,
            "proc_fee": proc_fee,
            "stamp_duty": stamp_duty,
            "insurance_fee": insurance_fee,
            "firs_vat": firs_vat,
            "total_fees": total_fees,
            "net_disbursed": net_disbursed,
            "collateral_desc": collateral_desc,
            "collateral_val": collateral_val,
            "has_vehicle": has_vehicle,
            "has_landed": has_landed,
            "is_lease": is_lease,
            "vehicle_make": vehicle_make,
            "vehicle_reg": vehicle_reg,
            "vehicle_chassis": vehicle_chassis,
            "property_location": property_location,
            "title_ref": title_ref,
            "guarantor_name": guarantor_name,
            "guarantor_address": guarantor_address,
            "guarantor_phone": guarantor_phone,
            "guarantor_occupation": guarantor_occupation
        }

    # =========================================================================
    # DOCUMENT 1: OFFICIAL OFFER LETTER
    # =========================================================================
    @classmethod
    def render_offer_letter(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        ref = f"OPTICOM/HRM/COO/{ctx['month_name']}/{ctx['day_str']}/'26"
        html = f"""
        <div class="legal-doc offer-letter">
          <div class="doc-header">
            <div class="brand">
              <h2 style="color: #0096cc; margin: 0; font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: 0.5px;">OPTICOM FINANCE LIMITED</h2>
              <div style="font-size: 8pt; color: #475569; margin-top: 3px;">
                10th Floor, UAC House, 1-5 Odunlami Street, Lagos Island &bull; {cls.OPTICOM_RC} &bull; Help-Line: {cls.OPTICOM_PHONE}
              </div>
            </div>
            <div style="text-align: right; font-size: 8.5pt; color: #334155;">
              <strong>Ref:</strong> {ref}<br />
              <strong>Date:</strong> {ctx['date_str']}
            </div>
          </div>
          <hr style="border: none; border-top: 2px solid #0096cc; margin: 12px 0 16px 0;" />

          <div style="margin-bottom: 14px; line-height: 1.4; font-size: 9pt;">
            The Managing Director,<br />
            <strong>{ctx['company_name']}</strong><br />
            {ctx['business_address']}<br />
            RC / BN: {ctx['rc_number']}
          </div>

          <p style="font-size: 9pt;">Dear Sir/Madam,</p>
          <h3 style="text-align: center; color: #0f172a; font-size: 10.5pt; text-transform: uppercase; margin: 14px 0; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px;">
            OFFER OF ₦{ctx['amount']:,.2f} ({ctx['amount_words'].upper()}) {ctx['facility_type'].upper()}
          </h3>

          <p style="font-size: 8.8pt; line-height: 1.5; color: #1e293b;">
            We refer to your credit application dated <strong>{ctx['date_str']}</strong>. We are pleased to convey that management and the Credit Committee have approved your credit request under the following binding commercial terms and covenants:
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 12px 0;">
            <tr style="background: #f8fafc;"><td style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 35%; font-weight: bold;">Facility Type:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1;">{ctx['facility_type']}</td></tr>
            <tr><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Approved Principal Amount:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #0096cc; font-weight: bold;">₦{ctx['amount']:,.2f} ({ctx['amount_words']})</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Facility Purpose:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1;">{ctx['purpose']}</td></tr>
            <tr><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Tenor / Duration:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1;">{ctx['tenor']} Months</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Lending Rate (APR):</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1;">{ctx['rate_apr']:.2f}% per annum (Approx. {ctx['rate_monthly']:.2f}% per month reducing balance)</td></tr>
            <tr><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Monthly Installment (PMT):</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">₦{ctx['monthly_pmt']:,.2f} ({ctx['monthly_pmt_words']})</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Repayment Channel:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Automated Remita / NIBSS Direct Debit Mandate &amp; Post-Dated Corporate Cheques in favor of Opticom Finance Limited</td></tr>
            <tr><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Total Upfront Fees &amp; Taxes:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #b91c1c; font-weight: bold;">₦{ctx['total_fees']:,.2f} (Management: ₦{ctx['mgt_fee']:,.2f}, Processing: ₦{ctx['proc_fee']:,.2f}, Stamp Duty: ₦{ctx['stamp_duty']:,.2f}, Insurance: ₦{ctx['insurance_fee']:,.2f}, FIRS VAT 7.5%: ₦{ctx['firs_vat']:,.2f})</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Net Disbursed Capital:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #059669; font-weight: bold;">₦{ctx['net_disbursed']:,.2f}</td></tr>
            <tr><td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold;">Collateral Security Pledged:</td><td style="padding: 6px 8px; border: 1px solid #cbd5e1;">{ctx['collateral_desc']} (Estimated Market Value: ₦{ctx['collateral_val']:,.2f})</td></tr>
          </table>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #d97706; padding: 8px 12px; margin: 12px 0; font-size: 8.3pt; line-height: 1.45;">
            <strong>MANDATORY DEFAULT PENALTY &amp; GRACE PERIOD CLAUSE:</strong><br />
            Prompt monthly debt service is of the absolute essence. A strict <strong>Seven (7) Calendar Days Grace Period</strong> is permitted from each monthly repayment due date. Should the obligor fail to fully service the due rental/installment within the 7-day grace window, an automatic <strong>Default Penalty of 5% flat per month</strong> shall be levied on all overdue amounts until liquidated in full, without prejudice to Opticom's statutory rights of repossession and legal enforcement.
          </div>

          <div style="font-size: 8.3pt; margin-top: 14px; line-height: 1.45;">
            <strong>CONDITIONS PRECEDENT TO DISBURSEMENT:</strong>
            <ol style="margin: 4px 0 12px 18px; padding: 0;">
              <li>Receipt of duly executed duplicate copy of this Offer Letter, Board Resolution, and Facility Agreements.</li>
              <li>Execution and stamping of Bill of Sale &amp; Right of Entry on pledged assets.</li>
              <li>Duly notarized Letters of Personal Guarantee by Principal Director and Third-Party Guarantor ({ctx['guarantor_name']}).</li>
              <li>Verification of Active Remita Direct Debit mandate / NIBSS e-Bills mandate.</li>
              <li>Comprehensive Insurance Policy over collateral pledged, with Opticom Finance Limited noted as First Loss Payee.</li>
            </ol>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 25px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 8.3pt;">
            <div style="width: 45%;">
              <strong>FOR: OPTICOM FINANCE LIMITED</strong><br /><br /><br />
              ________________________________<br />
              <strong>Folashade Tinubu</strong><br />
              Managing Director / CEO<br />
              Date: {ctx['date_str']}
            </div>
            <div style="width: 45%; text-align: right;">
              <strong>FOR: OPTICOM FINANCE LIMITED</strong><br /><br /><br />
              ________________________________<br />
              <strong>Chidinma Okafor</strong><br />
              Head of Risk Management (HRM)<br />
              Date: {ctx['date_str']}
            </div>
          </div>

          <div style="margin-top: 20px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 8.3pt;">
            <h4 style="margin: 0 0 6px 0; text-transform: uppercase;">BORROWER ACCEPTANCE SLIP</h4>
            We, <strong>{ctx['company_name']}</strong>, hereby unconditionally accept the terms, rates, covenants, 5% default penalty structure, and conditions precedent stipulated in this Facility Offer Letter.
            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
              <div>Director Signature: _______________________ Date: ___________</div>
              <div>Secretary Signature: _______________________ Date: ___________</div>
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "OFFER_LETTER",
            "title": f"Facility Offer Letter (₦{ctx['amount']:,.0f})",
            "subtitle": f"Binding Credit Term Sheet for {ctx['company_name']}",
            "is_mandatory": True,
            "filename": f"OFFER_LETTER_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 2: BILL OF SALE & RIGHT OF ENTRY (CLIENT / OBLIGOR)
    # =========================================================================
    @classmethod
    def render_bill_of_sale_client(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        asset_clause = f"{ctx['vehicle_make']} with Reg No: {ctx['vehicle_reg']} and Chassis No: {ctx['vehicle_chassis']}" if ctx['has_vehicle'] else ctx['collateral_desc']
        html = f"""
        <div class="legal-doc bill-of-sale">
          <div style="text-align: center; margin-bottom: 14px;">
            <h2 style="margin: 0; color: #041326; font-size: 13pt; letter-spacing: 1px;">BILL OF SALE &amp; RIGHT OF ENTRY</h2>
            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">(APPLICANT / PRINCIPAL BORROWER PLEDGE)</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            This AGREEMENT made this <strong>{ctx['day_str']}</strong> day of <strong>{ctx['month_name']} 2026</strong>, between <strong>{ctx['director_name']}</strong> of <strong>{ctx['residential_address']}</strong> acting for and on behalf of <strong>{ctx['company_name']}</strong> hereinafter called <strong>“the Seller”</strong> (which expression shall where the context so permits, include his/her successors-in-title and assigns) of the first part;
          </p>
          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>AND</strong><br />
            <strong>OPTICOM FINANCE LIMITED</strong>, a finance company incorporated under the laws of the Federal Republic of Nigeria and having its registered corporate head office at <strong>{cls.OPTICOM_ADDRESS}</strong> hereinafter called <strong>“the Buyer”</strong> (which expression shall where the context so permits include its successors-in-title and assigns) of the other part;
          </p>
          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>WITNESSETH:</strong> That for and in consideration of the facility sum of <strong>₦{ctx['amount']:,.2f} ({ctx['amount_words']})</strong>, receipt of which the Seller hereby acknowledges, and with no other consideration the Seller does hereby sell, assign, transfer, and convey unto the Buyer full equitable title and Deed of Sublease / Security Lien over the following chattel and asset:
          </p>

          <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 12px; margin: 14px 0; font-size: 9pt;">
            <strong>DESCRIPTION OF PLEDGED CHATTEL / ASSET:</strong><br />
            &bull; <strong>Asset Specification:</strong> {asset_clause}<br />
            &bull; <strong>Estimated Valuation:</strong> ₦{ctx['collateral_val']:,.2f}<br />
            &bull; <strong>Current Custody Location:</strong> {ctx['business_address']}
          </div>

          <h3 style="color: #b91c1c; font-size: 10pt; text-transform: uppercase; margin: 16px 0 6px 0; border-bottom: 1px solid #b91c1c; padding-bottom: 3px;">
            IRREVOCABLE RIGHT OF ENTRY &amp; REPOSSESSION COVENANT
          </h3>
          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify; color: #1e293b;">
            I/We, <strong>{ctx['director_name']}</strong> for <strong>{ctx['company_name']}</strong>, hereby irrevocably grant Opticom Finance Limited or any of its accredited recovery agents, representatives, bailiffs, or assigns, without waiver or further judicial summons, <strong>full, unconditional right of entry into my operating business premises, residential compound, garage, yards, or wherever the pledged asset [{asset_clause}] is kept or parked, to enter upon, impound, seize, and remove the asset</strong> in the event that the Borrower defaults on <strong>two (2) consecutive monthly rentals/installments</strong> or fails to remedy default within the stipulated 7-day grace period under facility <strong>{ctx['case_number']}</strong>.
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 35px; font-size: 8.5pt;">
            <div style="width: 48%;">
              SIGNED, SEALED &amp; DELIVERED by the Seller:<br /><br /><br />
              ____________________________________<br />
              <strong>{ctx['director_name']}</strong><br />
              For: {ctx['company_name']}<br />
              Date: {ctx['date_str']}
            </div>
            <div style="width: 48%; text-align: right;">
              The Common Seal of the Buyer:<br />
              <strong>OPTICOM FINANCE LIMITED</strong><br /><br /><br />
              ____________________________________<br />
              Authorised Signatory &amp; Corporate Seal<br />
              Date: {ctx['date_str']}
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "BILL_OF_SALE_CLIENT",
            "title": "Bill of Sale & Right of Entry (Borrower)",
            "subtitle": f"Equitable Chattel Lien on {asset_clause[:40]}...",
            "is_mandatory": True,
            "filename": f"BILL_OF_SALE_CLIENT_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 3: BILL OF SALE & RIGHT OF ENTRY (GUARANTOR)
    # =========================================================================
    @classmethod
    def render_bill_of_sale_guarantor(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        guarantor_asset = "Lexus ES350 with Reg No: RBC-850BD and Chassis No: JTHBJ46G272019101" if ctx['has_vehicle'] else f"Backing Chattel & Liquid Collateral Assets of {ctx['guarantor_name']}"
        html = f"""
        <div class="legal-doc bill-of-sale-guarantor">
          <div style="text-align: center; margin-bottom: 14px;">
            <h2 style="margin: 0; color: #041326; font-size: 13pt; letter-spacing: 1px;">BILL OF SALE &amp; RIGHT OF ENTRY</h2>
            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">(THIRD-PARTY GUARANTOR CHATTEL PLEDGE)</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            This AGREEMENT made this <strong>{ctx['day_str']}</strong> day of <strong>{ctx['month_name']} 2026</strong>, between <strong>{ctx['guarantor_name']}</strong> of <strong>{ctx['guarantor_address']}</strong> hereinafter called <strong>“the Seller / Guarantor”</strong> of the first part;
          </p>
          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>AND</strong><br />
            <strong>OPTICOM FINANCE LIMITED</strong> having its registered office at <strong>{cls.OPTICOM_ADDRESS}</strong> hereinafter called <strong>“the Buyer”</strong> of the other part;
          </p>
          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>WITNESSETH:</strong> In consideration of Opticom granting commercial credit facility <strong>{ctx['case_number']}</strong> in the principal sum of <strong>₦{ctx['amount']:,.2f} ({ctx['amount_words']})</strong> to the Principal Borrower <strong>{ctx['company_name']}</strong>, the Guarantor does hereby sell, assign, and convey unto the Buyer security title and Deed of Sublease over:
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 12px; margin: 14px 0; font-size: 9pt;">
            <strong>GUARANTOR BACKING CHATTEL:</strong><br />
            &bull; <strong>Asset Specification:</strong> {guarantor_asset}<br />
            &bull; <strong>Owner &amp; Pledgor:</strong> {ctx['guarantor_name']} ({ctx['guarantor_occupation']})<br />
            &bull; <strong>Premises Location:</strong> {ctx['guarantor_address']}
          </div>

          <h3 style="color: #b91c1c; font-size: 10pt; text-transform: uppercase; margin: 16px 0 6px 0; border-bottom: 1px solid #b91c1c; padding-bottom: 3px;">
            GUARANTOR RIGHT OF ENTRY
          </h3>
          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify; color: #1e293b;">
            I, <strong>{ctx['guarantor_name']}</strong> of {ctx['guarantor_address']}, hereby grant Opticom Finance Limited or its recovery assigns, without waiver, full right of entry into my premises, garage, or wherever the asset [{guarantor_asset}] is kept, to take immediate possession should <strong>{ctx['company_name']}</strong> default on facility repayments.
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 35px; font-size: 8.5pt;">
            <div style="width: 48%;">
              SIGNED &amp; SEALED by Guarantor:<br /><br /><br />
              ____________________________________<br />
              <strong>{ctx['guarantor_name']}</strong><br />
              Guarantor / Seller<br />
              Phone: {ctx['guarantor_phone']}
            </div>
            <div style="width: 48%; text-align: right;">
              Accepted for OPTICOM FINANCE LIMITED:<br /><br /><br />
              ____________________________________<br />
              Authorised Legal Representative<br />
              Date: {ctx['date_str']}
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "BILL_OF_SALE_GUARANTOR",
            "title": "Bill of Sale & Right of Entry (Guarantor)",
            "subtitle": f"Third-Party Chattel Lien by {ctx['guarantor_name']}",
            "is_mandatory": True,
            "filename": f"BILL_OF_SALE_GUARANTOR_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 4: LETTER OF PERSONAL GUARANTEE (CLIENT / PRINCIPAL)
    # =========================================================================
    @classmethod
    def render_guarantee_client(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        html = f"""
        <div class="legal-doc guarantee-client">
          <div style="text-align: center; margin-bottom: 14px;">
            <h2 style="margin: 0; color: #041326; font-size: 13pt; letter-spacing: 1px;">DEED OF PERSONAL CONTINUING GUARANTEE &amp; INDEMNITY</h2>
            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">(EXECUTED BY PRINCIPAL BORROWER DIRECTOR)</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            IN CONSIDERATION of <strong>OPTICOM FINANCE LIMITED</strong> (hereinafter called “Opticom”) whose registered office is situated at <strong>{cls.OPTICOM_ADDRESS}</strong> granting credit facilities including making or continuing advances, term loan, or equipment lease accommodations to <strong>{ctx['company_name']}</strong> (hereinafter called “the Principal”) situated at <strong>{ctx['business_address']}</strong>;
          </p>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>I, THE UNDERSIGNED:</strong><br />
            <strong>{ctx['director_name']}</strong>, residing at <strong>{ctx['residential_address']}</strong> (hereinafter called “the Guarantor”) <strong>HEREBY PERSONALLY AND IRREVOCABLY GUARANTEE</strong> payment to Opticom on demand, free of any taxes, deductions, or set-offs, the immediate reimbursement of all monies, principal, accrued interest, statutory charges, and legal fees due or owing from the Principal under facility reference <strong>{ctx['case_number']}</strong>.
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin: 12px 0; font-size: 8.5pt;">
            <strong>MANDATORY GUARANTEE QUANTUM &amp; LIMITS:</strong><br />
            &bull; Approved Principal Loan Amount: <strong>₦{ctx['amount']:,.2f} ({ctx['amount_words']})</strong><br />
            &bull; Total Interest &amp; Commercial Charges: <strong>₦{ctx['total_interest']:,.2f} ({ctx['total_interest_words']})</strong><br />
            &bull; <strong>Total Maximum Recoverable Quantum:</strong> <span style="color: #b91c1c; font-weight: bold;">₦{ctx['total_repayment']:,.2f} ({ctx['total_repayment_words']})</span><br />
            &bull; <strong>Default Interest Covenant:</strong> In the event of default exceeding the 7-day grace period, interest shall accrue on the outstanding balance at <strong>5% flat per month</strong> until date of final liquidation.
          </div>

          <p style="font-size: 8.4pt; line-height: 1.5; text-align: justify; color: #334155;">
            1. This Guarantee shall be a <strong>continuing security</strong> and shall not be satisfied by any intermediate payment or partial settlement.<br />
            2. The liability of the Guarantor hereunder shall be as <strong>principal debtor</strong>, and Opticom shall not be bound to exhaust recourse against the Principal or enforce any pledged securities prior to making demand upon the Guarantor.<br />
            3. This Guarantee is governed by the laws of the Federal Republic of Nigeria, and the Guarantor submits to the jurisdiction of the Nigerian Courts.
          </p>

          <div style="margin-top: 35px; font-size: 8.5pt;">
            DATED THIS <strong>{ctx['day_str']}</strong> DAY OF <strong>{ctx['month_name']} 2026</strong>.<br /><br />
            SIGNED, SEALED AND DELIVERED by the within-named Guarantor:<br /><br /><br />
            _____________________________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _______________________<br />
            <strong>{ctx['director_name']}</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SIGNATURE<br />
            Director, {ctx['company_name']}<br />
            BVN: {ctx['bvn']}
          </div>
        </div>
        """
        return {
            "doc_type": "GUARANTEE_CLIENT",
            "title": "Letter of Guarantee (Applicant)",
            "subtitle": f"Personal Director Guarantee by {ctx['director_name']}",
            "is_mandatory": True,
            "filename": f"GUARANTEE_CLIENT_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 5: LETTER OF PERSONAL GUARANTEE (GUARANTOR)
    # =========================================================================
    @classmethod
    def render_guarantee_guarantor(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        html = f"""
        <div class="legal-doc guarantee-guarantor">
          <div style="text-align: center; margin-bottom: 14px;">
            <h2 style="margin: 0; color: #041326; font-size: 13pt; letter-spacing: 1px;">DEED OF THIRD-PARTY PERSONAL GUARANTEE &amp; INDEMNITY</h2>
            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">(EXECUTED BY EXTERNAL INDIVIDUAL GUARANTOR)</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            IN CONSIDERATION of <strong>OPTICOM FINANCE LIMITED</strong> whose registered office is situated at <strong>{cls.OPTICOM_ADDRESS}</strong> extending commercial credit facility <strong>{ctx['case_number']}</strong> to <strong>{ctx['company_name']}</strong> (hereinafter called “the Principal”) situated at <strong>{ctx['business_address']}</strong>;
          </p>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>I, THE UNDERSIGNED:</strong><br />
            <strong>{ctx['guarantor_name']}</strong>, of <strong>{ctx['guarantor_address']}</strong> ({ctx['guarantor_occupation']}) <strong>HEREBY UNCONDITIONALLY AND IRREVOCABLY GUARANTEE</strong> payment to Opticom on first written demand of all obligations, sums, and liabilities owed by the Principal.
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin: 12px 0; font-size: 8.5pt;">
            <strong>GUARANTOR INDEMNITY COVENANTS:</strong><br />
            &bull; Obligor Guaranteed: <strong>{ctx['company_name']}</strong> (RC: {ctx['rc_number']})<br />
            &bull; Maximum Guaranteed Sum: <strong>₦{ctx['total_repayment']:,.2f} ({ctx['total_repayment_words']})</strong><br />
            &bull; Default Interest Clause: <strong>5% flat per month</strong> following the statutory 7-day grace period on any unpaid installments.<br />
            &bull; Nature of Obligation: <strong>Primary, Independent, and Continuing Guarantee</strong>.
          </div>

          <div style="margin-top: 35px; font-size: 8.5pt;">
            DATED THIS <strong>{ctx['day_str']}</strong> DAY OF <strong>{ctx['month_name']} 2026</strong>.<br /><br />
            SIGNED, SEALED AND DELIVERED by the Guarantor:<br /><br /><br />
            _____________________________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _______________________<br />
            <strong>{ctx['guarantor_name']}</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SIGNATURE<br />
            Address: {ctx['guarantor_address']}<br />
            Phone: {ctx['guarantor_phone']}
          </div>
        </div>
        """
        return {
            "doc_type": "GUARANTEE_GUARANTOR",
            "title": "Letter of Guarantee (Guarantor)",
            "subtitle": f"Third-Party Guarantee by {ctx['guarantor_name']}",
            "is_mandatory": True,
            "filename": f"GUARANTEE_GUARANTOR_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 6: LETTER OF TRANSFER OF OWNERSHIP (VEHICLE COLLATERAL)
    # =========================================================================
    @classmethod
    def render_transfer_of_ownership(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        html = f"""
        <div class="legal-doc transfer-ownership">
          <div style="text-align: center; margin-bottom: 14px;">
            <h2 style="margin: 0; color: #041326; font-size: 13pt; letter-spacing: 1px;">DEED OF TRANSFER OF MOTOR VEHICLE OWNERSHIP &amp; POWER OF ATTORNEY</h2>
            <div style="font-size: 8pt; color: #0096cc; font-weight: bold; margin-top: 2px;">[COLLATERAL VEHICLE SECURITY ENFORCEMENT INSTRUMENT]</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            This DEED is executed this <strong>{ctx['day_str']}</strong> day of <strong>{ctx['month_name']} 2026</strong>, by <strong>{ctx['company_name']}</strong> / <strong>{ctx['director_name']}</strong> of {ctx['business_address']} (the “Transferor / Assignor”) in favor of <strong>OPTICOM FINANCE LIMITED</strong> of {cls.OPTICOM_ADDRESS} (the “Transferee / Assignee”);
          </p>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>WHEREAS:</strong> In consideration of credit facility <strong>{ctx['case_number']}</strong> granted to the Transferor in the sum of <strong>₦{ctx['amount']:,.2f}</strong>, the Transferor hereby transfers all legal and equitable rights, title, and ownership of the motor vehicle specified below to Opticom Finance Limited:
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 12px; margin: 14px 0; font-size: 9pt;">
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
              <tr><td style="padding: 5px; width: 35%; font-weight: bold;">Vehicle Make &amp; Model:</td><td style="padding: 5px;">{ctx['vehicle_make']}</td></tr>
              <tr style="background: #f1f5f9;"><td style="padding: 5px; font-weight: bold;">Registration Number:</td><td style="padding: 5px; font-weight: bold; color: #0096cc;">{ctx['vehicle_reg']}</td></tr>
              <tr><td style="padding: 5px; font-weight: bold;">Chassis Number:</td><td style="padding: 5px; font-family: monospace;">{ctx['vehicle_chassis']}</td></tr>
              <tr style="background: #f1f5f9;"><td style="padding: 5px; font-weight: bold;">Vehicle Engine Number:</td><td style="padding: 5px; font-family: monospace;">ENG-2GR-FE-998812</td></tr>
              <tr><td style="padding: 5px; font-weight: bold;">Current Registered Owner:</td><td style="padding: 5px;">{ctx['company_name']} / {ctx['director_name']}</td></tr>
            </table>
          </div>

          <p style="font-size: 8.6pt; line-height: 1.5; text-align: justify; color: #1e293b;">
            <strong>IRREVOCABLE POWER OF ATTORNEY:</strong> The Transferor hereby irrevocably appoints Opticom Finance Limited and its managing agents as its true and lawful Attorney with full authority to register, endorse, sign MVAA Form MVA01, present vehicle documents to the Federal Road Safety Corps (FRSC) and Motor Vehicle Administration, and take physical possession or liquidate the vehicle upon default of loan covenants.
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 35px; font-size: 8.5pt;">
            <div style="width: 48%;">
              Transferor Signature &amp; Seal:<br /><br /><br />
              ____________________________________<br />
              <strong>{ctx['director_name']}</strong><br />
              For: {ctx['company_name']}
            </div>
            <div style="width: 48%; text-align: right;">
              Transferee Acceptance:<br />
              <strong>OPTICOM FINANCE LIMITED</strong><br /><br /><br />
              ____________________________________<br />
              Authorized Corporate Trustee
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "TRANSFER_OF_OWNERSHIP",
            "title": "Letter of Transfer of Ownership (Vehicle)",
            "subtitle": f"Automobile Transfer Instrument for {ctx['vehicle_make']}",
            "is_mandatory": ctx["has_vehicle"],
            "filename": f"TRANSFER_OF_OWNERSHIP_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 7: LETTER OF TRIPARTITE AGREEMENT (LANDED PROPERTY)
    # =========================================================================
    @classmethod
    def render_tripartite_agreement(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        html = f"""
        <div class="legal-doc tripartite-agreement">
          <div style="text-align: center; margin-bottom: 14px;">
            <h2 style="margin: 0; color: #041326; font-size: 13pt; letter-spacing: 1px;">TRIPARTITE LEGAL AGREEMENT &amp; EQUITABLE MORTGAGE CONVEYANCE</h2>
            <div style="font-size: 8pt; color: #059669; font-weight: bold; margin-top: 2px;">[LANDED PROPERTY &amp; ESCROW PROCEEDS SECURITY STRUCTURE]</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            This TRIPARTITE AGREEMENT is made this <strong>{ctx['day_str']}</strong> day of <strong>{ctx['month_name']} 2026</strong>, AMONG:
          </p>
          <ol style="font-size: 8.8pt; line-height: 1.5; margin: 4px 0 10px 18px; padding: 0;">
            <li><strong>OPTICOM FINANCE LIMITED</strong> of {cls.OPTICOM_ADDRESS} (the “Lender / Mortgagee”);</li>
            <li><strong>{ctx['company_name']}</strong> of {ctx['business_address']} (the “Borrower / Mortgagor”); and</li>
            <li><strong>{ctx['guarantor_name']}</strong> / Property Title Holder of {ctx['guarantor_address']} (the “Title Trustee / Third-Party Pledgor”).</li>
          </ol>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            <strong>WHEREAS:</strong> The Borrower has obtained facility <strong>{ctx['case_number']}</strong> in the sum of <strong>₦{ctx['amount']:,.2f}</strong>, secured by landed property and tripartite proceeds as detailed below:
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 12px; margin: 12px 0; font-size: 8.8pt;">
            <strong>LANDED PROPERTY / MORTGAGE PARTICULARS:</strong><br />
            &bull; <strong>Property Location:</strong> {ctx['property_location']}<br />
            &bull; <strong>Title Document:</strong> {ctx['title_ref']}<br />
            &bull; <strong>Estimated Valuation:</strong> ₦{ctx['collateral_val']:,.2f} ({naira_to_words(ctx['collateral_val'])})<br />
            &bull; <strong>Security Charge:</strong> Irrevocable deposit of original Title Deeds &amp; Registration of Legal Sublease in favor of Opticom Finance Limited.
          </div>

          <p style="font-size: 8.6pt; line-height: 1.5; text-align: justify; color: #1e293b;">
            The Title Trustee confirms that the property is free of prior encumbrances and irrevocably undertakes not to alienate, transfer, or further mortgage the property until Opticom issues a formal Deed of Release upon complete facility discharge.
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 8.3pt;">
            <div>
              Lender:<br />
              <strong>OPTICOM FINANCE LIMITED</strong><br /><br />
              ___________________________<br />
              Managing Director / Legal
            </div>
            <div>
              Borrower:<br />
              <strong>{ctx['company_name']}</strong><br /><br />
              ___________________________<br />
              {ctx['director_name']} (Director)
            </div>
            <div>
              Property Trustee:<br />
              <strong>{ctx['guarantor_name']}</strong><br /><br />
              ___________________________<br />
              Title Holder / Pledgor
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "TRIPARTITE_AGREEMENT",
            "title": "Letter of Tripartite Agreement (Landed Property)",
            "subtitle": f"Tripartite Security Deed for {ctx['property_location'][:35]}...",
            "is_mandatory": ctx["has_landed"],
            "filename": f"TRIPARTITE_AGREEMENT_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 8A: LEASE AGREEMENT (FOR LEASE FACILITIES)
    # =========================================================================
    @classmethod
    def render_lease_agreement(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        html = f"""
        <div class="legal-doc lease-agreement">
          <div style="text-align: center; margin-bottom: 14px;">
            <div style="font-size: 9pt; font-weight: bold; color: #64748b;">DATED THE {ctx['day_str']} DAY OF {ctx['month_name']} 2026</div>
            <h2 style="margin: 6px 0; color: #041326; font-size: 14pt; letter-spacing: 1px;">EQUIPMENT LEASE AGREEMENT</h2>
            <div style="font-size: 9pt; font-weight: bold; color: #0096cc;">BETWEEN OPTICOM FINANCE LIMITED AND {ctx['company_name'].upper()}</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            THIS LEASE AGREEMENT is made the <strong>{ctx['day_str']}</strong> day of <strong>{ctx['month_name']} 2026</strong> BETWEEN <strong>OPTICOM FINANCE LIMITED</strong>, having its registered office at <strong>{cls.OPTICOM_ADDRESS}</strong> (hereinafter called “the Lessor”) of the one part, and <strong>{ctx['company_name']}</strong> of <strong>{ctx['business_address']}</strong> (hereinafter called “the Lessee”) of the other part.
          </p>

          <h3 style="font-size: 9.5pt; color: #0f172a; margin: 12px 0 4px 0;">1. LEASE FINANCING &amp; RENTALS</h3>
          <p style="font-size: 8.8pt; line-height: 1.5; text-align: justify;">
            The Total Principal Financed by the Lessor is <strong>₦{ctx['amount']:,.2f} ({ctx['amount_words']})</strong>. The Lessee shall pay to the Lessor lease rentals in <strong>{ctx['tenor']} monthly installments</strong> of <strong>₦{ctx['monthly_pmt']:,.2f} ({ctx['monthly_pmt_words']})</strong>, totaling <strong>₦{ctx['total_repayment']:,.2f}</strong> over the lease period via automated Remita/Mono direct debit mandate.
          </p>

          <h3 style="font-size: 9.5pt; color: #0f172a; margin: 12px 0 4px 0;">2. DEFAULT, 7-DAY GRACE PERIOD &amp; 5% PENALTY</h3>
          <p style="font-size: 8.8pt; line-height: 1.5; text-align: justify;">
            Should the Lessee fail to pay any lease rental on the due date, a grace period of seven (7) calendar days is permitted. Upon expiration of seven days, a penalty rate of <strong>5% flat per month</strong> shall apply to all overdue amounts until paid in full. If default persists for two consecutive rental cycles, the Lessor shall exercise immediate right of entry and repossession.
          </p>

          <h3 style="font-size: 9.5pt; color: #0f172a; margin: 12px 0 4px 0;">3. TITLE, MAINTENANCE &amp; PURCHASE OPTION</h3>
          <p style="font-size: 8.8pt; line-height: 1.5; text-align: justify;">
            Ownership of the leased asset remains vested in the Lessor during the lease tenor. Upon successful completion of all {ctx['tenor']} rental payments and settlement of all dues, the Lessee shall have the option to purchase the asset for a nominal terminal consideration of ₦1,000.00.
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 35px; font-size: 8.5pt;">
            <div style="width: 48%;">
              The Common Seal of the Lessor:<br />
              <strong>OPTICOM FINANCE LIMITED</strong><br /><br /><br />
              ____________________________________<br />
              Director / Authorized Signatory
            </div>
            <div style="width: 48%; text-align: right;">
              The Common Seal of the Lessee:<br />
              <strong>{ctx['company_name']}</strong><br /><br /><br />
              ____________________________________<br />
              Managing Director &amp; Company Secretary
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "LEASE_AGREEMENT",
            "title": "Equipment Lease Agreement",
            "subtitle": f"Binding Lease Contract ({ctx['tenor']} Months)",
            "is_mandatory": ctx["is_lease"],
            "filename": f"LEASE_AGREEMENT_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # DOCUMENT 8B: LOAN AGREEMENT (FOR LOAN FACILITIES)
    # =========================================================================
    @classmethod
    def render_loan_agreement(cls, ctx: Dict[str, Any]) -> Dict[str, Any]:
        html = f"""
        <div class="legal-doc loan-agreement">
          <div style="text-align: center; margin-bottom: 14px;">
            <div style="font-size: 9pt; font-weight: bold; color: #64748b;">DATED THE {ctx['day_str']} DAY OF {ctx['month_name']} 2026</div>
            <h2 style="margin: 6px 0; color: #041326; font-size: 14pt; letter-spacing: 1px;">COMMERCIAL LOAN AGREEMENT</h2>
            <div style="font-size: 9pt; font-weight: bold; color: #0096cc;">BETWEEN OPTICOM FINANCE LIMITED AND {ctx['company_name'].upper()}</div>
          </div>

          <p style="font-size: 8.8pt; line-height: 1.55; text-align: justify;">
            THIS LOAN AGREEMENT is made the <strong>{ctx['day_str']}</strong> day of <strong>{ctx['month_name']} 2026</strong>, BETWEEN <strong>OPTICOM FINANCE LIMITED</strong>, having its registered office at <strong>{cls.OPTICOM_ADDRESS}</strong> (hereinafter called “the Lender”) of the one part, and <strong>{ctx['company_name']}</strong> of <strong>{ctx['business_address']}</strong> (hereinafter called “the Borrower”) of the other part.
          </p>

          <h3 style="font-size: 9.5pt; color: #0f172a; margin: 12px 0 4px 0;">1. PRINCIPAL ADVANCE &amp; DISBURSEMENT</h3>
          <p style="font-size: 8.8pt; line-height: 1.5; text-align: justify;">
            The Lender agrees to make available to the Borrower a term loan facility in the principal sum of <strong>₦{ctx['amount']:,.2f} ({ctx['amount_words']})</strong> for a tenor of <strong>{ctx['tenor']} Months</strong>, subject to statutory deductions of ₦{ctx['total_fees']:,.2f}, resulting in net disbursed capital of ₦{ctx['net_disbursed']:,.2f}.
          </p>

          <h3 style="font-size: 9.5pt; color: #0f172a; margin: 12px 0 4px 0;">2. REPAYMENT SCHEDULE &amp; MONO/REMITA MANDATE</h3>
          <p style="font-size: 8.8pt; line-height: 1.5; text-align: justify;">
            The Borrower shall repay the loan in {ctx['tenor']} monthly installments of <strong>₦{ctx['monthly_pmt']:,.2f} ({ctx['monthly_pmt_words']})</strong>, representing principal and interest at {ctx['rate_apr']:.2f}% APR. Repayment shall be via Remita/Mono Direct Debit activated on the Borrower's designated commercial bank account.
          </p>

          <h3 style="font-size: 9.5pt; color: #0f172a; margin: 12px 0 4px 0;">3. DEFAULT PENALTY &amp; ACCELERATION</h3>
          <p style="font-size: 8.8pt; line-height: 1.5; text-align: justify;">
            A grace period of seven (7) days is allowed. Any overdue installment remaining unpaid after seven days shall attract a default penalty of <strong>5% per month</strong>. If default continues beyond 14 days, the Lender may declare the entire outstanding loan balance immediately due and payable.
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 35px; font-size: 8.5pt;">
            <div style="width: 48%;">
              The Common Seal of the Lender:<br />
              <strong>OPTICOM FINANCE LIMITED</strong><br /><br /><br />
              ____________________________________<br />
              Director / Authorized Signatory
            </div>
            <div style="width: 48%; text-align: right;">
              The Common Seal of the Borrower:<br />
              <strong>{ctx['company_name']}</strong><br /><br /><br />
              ____________________________________<br />
              Managing Director &amp; Company Secretary
            </div>
          </div>
        </div>
        """
        return {
            "doc_type": "LOAN_AGREEMENT",
            "title": "Commercial Loan Agreement",
            "subtitle": f"Binding Term Loan Contract ({ctx['tenor']} Months)",
            "is_mandatory": not ctx["is_lease"],
            "filename": f"LOAN_AGREEMENT_{ctx['case_number']}.html",
            "html": html
        }

    # =========================================================================
    # MASTER SUITE COMPILER
    # =========================================================================
    @classmethod
    def generate_case_documents(cls, credit_case: Any, db: Session = None) -> List[Dict[str, Any]]:
        """
        Compiles the complete suite of approval documents based on case parameters.
        """
        ctx = cls.extract_case_context(credit_case)
        docs = []

        # 1. Offer Letter (Always generated)
        docs.append(cls.render_offer_letter(ctx))

        # 2. Bill of Sale - Client (Always generated)
        docs.append(cls.render_bill_of_sale_client(ctx))

        # 3. Bill of Sale - Guarantor (Generated)
        docs.append(cls.render_bill_of_sale_guarantor(ctx))

        # 4. Guarantee - Client (Always generated)
        docs.append(cls.render_guarantee_client(ctx))

        # 5. Guarantee - Guarantor (Always generated)
        docs.append(cls.render_guarantee_guarantor(ctx))

        # 6. Transfer of Ownership (Generated if vehicle collateral)
        if ctx["has_vehicle"]:
            docs.append(cls.render_transfer_of_ownership(ctx))

        # 7. Tripartite Agreement (Generated if landed property)
        if ctx["has_landed"]:
            docs.append(cls.render_tripartite_agreement(ctx))

        # 8. Facility Agreement (Lease OR Loan based on structure)
        if ctx["is_lease"]:
            docs.append(cls.render_lease_agreement(ctx))
        else:
            docs.append(cls.render_loan_agreement(ctx))

        return docs
