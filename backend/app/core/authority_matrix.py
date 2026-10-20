"""
Authority Matrix and Mandate Routing (PRD Section 4 & FR-09)
Determines required approval authority chain and validates reviewer mandates based on loan amount.
"""
from typing import List, Dict, Any, Tuple

class AuthorityMatrix:
    # Amount Mandate Thresholds
    TIER_HRM_MAX = 5_000_000.0    # HRM can approve up to ₦5m
    TIER_BCC_MAX = 15_000_000.0   # BCC can approve up to ₦15m
    # Loans > ₦15m mandate Managing Director (MD) sign-off

    @classmethod
    def get_required_approval_chain(cls, amount: float) -> List[Dict[str, Any]]:
        """
        Returns the mandatory sequential authority levels required for a given facility amount.
        """
        chain = [
            {"level": "ANALYST", "role": "Credit Analyst", "action": "RECOMMENDATION", "mandatory": True},
            {"level": "HRM", "role": "Head of Risk Management", "action": "APPROVAL" if amount <= cls.TIER_HRM_MAX else "ENDORSEMENT", "mandatory": True}
        ]
        
        if amount > cls.TIER_HRM_MAX:
            chain.append({
                "level": "BCC", 
                "role": "Board Credit Committee / Authoriser", 
                "action": "APPROVAL" if amount <= cls.TIER_BCC_MAX else "CONCURRENCE", 
                "mandatory": True
            })
            
        if amount > cls.TIER_BCC_MAX:
            chain.append({
                "level": "MD", 
                "role": "Managing Director", 
                "action": "FINAL_APPROVAL", 
                "mandatory": True
            })
            
        return chain

    @classmethod
    def can_user_approve(cls, role: str, amount: float) -> Tuple[bool, str]:
        """
        Validates if a specific user role has delegated authority to approve a loan amount.
        """
        role = role.upper()
        if role == "ANALYST":
            return False, "Credit Analysts only have recommendation authority, not final approval (PRD Section 4)."
        
        if role == "HRM":
            if amount <= cls.TIER_HRM_MAX:
                return True, "Authorized within HRM delegated limit (up to ₦5m)."
            return False, f"Loan amount (₦{amount:,.2f}) exceeds HRM limit of ₦{cls.TIER_HRM_MAX:,.2f}. Must route to BCC/MD."
            
        if role == "BCC":
            if amount <= cls.TIER_BCC_MAX:
                return True, "Authorized within BCC delegated limit (up to ₦15m)."
            return False, f"Loan amount (₦{amount:,.2f}) exceeds BCC limit of ₦{cls.TIER_BCC_MAX:,.2f}. Must route to MD."
            
        if role in ["MD", "CEO", "MANAGING_DIRECTOR"]:
            return True, "Authorized for highest tier approval mandate (> ₦15m)."
            
        return False, f"Role '{role}' does not possess credit approval delegated authority."
