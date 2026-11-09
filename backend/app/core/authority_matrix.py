"""
Authority Matrix and Mandate Routing (Opticom Credit Policy Manual)
Determines required approval authority chain and validates reviewer mandates based on loan amount.

Opticom Governance Sequence:
1. Credit Analyst (CAM generation & underwriting recommendation to MCC)
2. Head of Business Development (First reviewer in Management Credit Committee - MCC)
3. Head of Risk Management (HRM risk assessment & concurrence)
4. Managing Director (MD final sanction, offer letter auto-generation & dispatch)
5. Board Credit Committee (BCC final approval for amounts > ₦20,000,000)
"""
from typing import List, Dict, Any, Tuple

class AuthorityMatrix:
    # Amount Mandate Thresholds
    TIER_1_LIMIT = 5_000_000.0          # HRM standalone mandate limit (₦5m)
    TIER_HRM_MAX = 5_000_000.0          # Reference limit for internal risk reviews
    TIER_BCC_THRESHOLD = 20_000_000.0   # Facilities > ₦20m mandate Board Credit Committee (BCC) final approval

    @classmethod
    def get_required_approval_chain(cls, amount: float) -> List[Dict[str, Any]]:
        """
        Returns the mandatory sequential authority levels required for a given facility amount.
        """
        chain = [
            {"level": "ANALYST", "role": "Credit Analyst", "action": "RECOMMENDATION", "mandatory": True},
            {"level": "HEAD_OF_BD", "role": "Head of Business Development (MCC)", "action": "MCC_FIRST_REVIEW", "mandatory": True},
            {"level": "HRM", "role": "Head of Risk Management", "action": "RISK_CONCURRENCE", "mandatory": True},
            {"level": "MD", "role": "Managing Director", "action": "FINAL_APPROVAL" if amount <= cls.TIER_BCC_THRESHOLD else "EXECUTIVE_ENDORSEMENT", "mandatory": True}
        ]
        
        # Facilities > ₦20,000,000 require Board Credit Committee (BCC) final approval
        if amount > cls.TIER_BCC_THRESHOLD:
            chain.append({
                "level": "BCC", 
                "role": "Board Credit Committee (BCC)", 
                "action": "FINAL_APPROVAL", 
                "mandatory": True
            })
            
        return chain

    @classmethod
    def can_user_approve(cls, role: str, amount: float) -> Tuple[bool, str]:
        """
        Validates if a specific user role has delegated authority to approve a loan amount.
        """
        role = role.upper().replace(" ", "_")
        if role in ["ANALYST", "CREDIT_ANALYST"]:
            return False, "Credit Analysts only have recommendation authority, not final approval."
            
        if role in ["HEAD_OF_BD", "BDO_HEAD", "BD"]:
            return True, "Authorized for Business Development commercial recommendation/endorsement."
        
        if role in ["HRM", "HEAD_OF_RISK_MANAGEMENT"]:
            if amount <= cls.TIER_1_LIMIT:
                return True, f"Authorized for risk management approval up to ₦{cls.TIER_1_LIMIT:,.2f}."
            return False, f"Facility quantum (₦{amount:,.2f}) exceeds HRM standalone mandate limit of ₦{cls.TIER_1_LIMIT:,.2f}; escalation required."
            
        if role in ["MD", "CEO", "MANAGING_DIRECTOR", "ADMIN", "SYSADMIN", "SUPERADMIN"]:
            if amount <= cls.TIER_BCC_THRESHOLD:
                return True, f"Authorized with highest executive administrative approval mandate (up to ₦{cls.TIER_BCC_THRESHOLD:,.2f})."
            return True, f"Authorized for Executive Endorsement / Administrative Sanction (> ₦{cls.TIER_BCC_THRESHOLD:,.2f}) prior to BCC final sign-off."
            
        if role in ["BCC", "BOARD_CREDIT_COMMITTEE"]:
            return True, "Authorized for Board Credit Committee final sanction (mandatory for > ₦20,000,000)."
            
        return False, f"Role '{role}' does not possess credit approval delegated authority."
