/**
 * Canonical Opticom Facility Classifications, RC/BN requirements, and
 * Classification-Aware Guarantor Governance Rules.
 */

export interface FacilityClassificationOption {
  value: string;
  label: string;
  category: 'COMMERCIAL' | 'CONSUMER_SALARY' | 'ASSET_REAL_ESTATE';
  description: string;
}

export const FACILITY_CLASSIFICATIONS: FacilityClassificationOption[] = [
  {
    value: 'Working Capital',
    label: 'Working Capital',
    category: 'COMMERCIAL',
    description: 'Short-to-medium term operational liquidity, inventory restocking, and supplier payments'
  },
  {
    value: 'Salary Loan / Payroll Advance',
    label: 'Salary Loan / Payroll Advance',
    category: 'CONSUMER_SALARY',
    description: 'Verified salaried employee personal credit facility backed by payroll domiciliation and guarantor'
  },
  {
    value: 'Purchase Order Execution',
    label: 'Purchase Order / Contract Financing',
    category: 'COMMERCIAL',
    description: 'Verified LPO, haulage, supply chain, or corporate contract mobilization finance'
  },
  {
    value: 'Asset Finance',
    label: 'Fleet & Heavy Machinery Lease / Asset Finance',
    category: 'ASSET_REAL_ESTATE',
    description: 'Commercial vehicles, trucks, yellow iron equipment, or productive plant lease'
  },
  {
    value: 'Invoice Discounting',
    label: 'Receivables & Invoice Discounting',
    category: 'COMMERCIAL',
    description: 'Immediate cash advance against confirmed blue-chip or sovereign receivables'
  },
  {
    value: 'Bridging / Commercial Term Loan',
    label: 'Bridging / Commercial Term Loan',
    category: 'COMMERCIAL',
    description: 'Structured short-term bridge facility or expansion capital loan'
  },
  {
    value: 'Real Estate & Property Finance',
    label: 'Real Estate / Property Development Finance',
    category: 'ASSET_REAL_ESTATE',
    description: 'Mortgage-backed commercial property acquisition, construction, or landed asset financing'
  },
  {
    value: 'Personal / Consumer Term Loan',
    label: 'Personal / Consumer Term Loan',
    category: 'CONSUMER_SALARY',
    description: 'Accredited individual / HNWI structured term loan with third-party surety'
  }
];

export interface GuarantorRequirementSpec {
  required: boolean;
  title: string;
  subtitle: string;
  occupationLabel: string;
  occupationPlaceholder: string;
  addressLabel: string;
}

export function getGuarantorRequirement(
  facilityType: string,
  applicantType: string
): GuarantorRequirementSpec {
  if (
    facilityType === 'Salary Loan / Payroll Advance' ||
    facilityType === 'Personal / Consumer Term Loan' ||
    applicantType === 'INDIVIDUAL'
  ) {
    return {
      required: true,
      title: 'Mandatory Guarantor & Surety Details (Salary / Individual Facility)',
      subtitle:
        'Provide an independent, gainfully employed guarantor (senior colleague, civil servant, or creditworthy third-party surety — different from the applicant). Upon approval, the Letter of Guarantee will be addressed and emailed directly to this guarantor.',
      occupationLabel: 'Guarantor Employer / Grade / Occupation *',
      occupationPlaceholder: 'e.g. Senior Manager, First Bank PLC / Grade Level 14 Civil Servant',
      addressLabel: 'Guarantor Verified Residential Address *'
    };
  }

  if (
    facilityType === 'Asset Finance' ||
    facilityType === 'Real Estate & Property Finance'
  ) {
    return {
      required: true,
      title: 'Mandatory Third-Party Guarantor & Surety Details (Asset / Property Facility)',
      subtitle:
        'Provide a creditworthy third-party guarantor / co-obligor surety (separate from the applicant). Upon approval, the Deed of Guarantee and ancillary security letters are issued to this guarantor.',
      occupationLabel: 'Guarantor Designation / Occupation / Relationship *',
      occupationPlaceholder: 'e.g. Executive Director / Co-Surety / Property Co-Guarantor',
      addressLabel: 'Guarantor Verified Residential / Office Address *'
    };
  }

  return {
    required: true,
    title: 'Mandatory Third-Party Guarantor & Surety Details (Independent of Applicant / Promoter)',
    subtitle:
      'A Guarantor is mandatory and distinct from the Applicant or Managing Director/Promoter taking the loan. Opticom delivers the Guarantor Letter of Guarantee to this contact email upon sanction.',
    occupationLabel: 'Guarantor Occupation / Designation *',
    occupationPlaceholder: 'e.g. Managing Partner, Horizon Logistics Ltd / Principal Consultant',
    addressLabel: 'Guarantor Verified Residential Address *'
  };
}

export function isRcNumberRequired(
  applicantType: string,
  facilityType: string
): boolean {
  if (applicantType === 'INDIVIDUAL') return false;
  if (
    facilityType === 'Salary Loan / Payroll Advance' ||
    facilityType === 'Personal / Consumer Term Loan'
  ) {
    return applicantType === 'CORPORATE';
  }
  return applicantType === 'SME' || applicantType === 'CORPORATE';
}

