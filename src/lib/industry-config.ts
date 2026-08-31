// src/lib/industry-config.ts

export const INDUSTRY_KEYS = [
  "ENERGY_SOLAR",
  "HOME_SERVICES_TRADES",
  "LEGAL_FINANCIAL",
  "HEALTHCARE_MEDICAL",
  "BUILDING_CONSTRUCTION",
  "ECOMMERCE_RETAIL",
  "PROFESSIONAL_B2B",
  "AUTOMOTIVE_TRANSPORT",
  "REAL_ESTATE_PROPERTY",
  "EDUCATION_TRAINING",
  "HOSPITALITY_EVENTS",
  "OTHER",
] as const;

export type IndustryKey = (typeof INDUSTRY_KEYS)[number];

export interface IndustryMetadata {
  key: IndustryKey;
  label: string;
  shortLabel: string;
  iconName: string;
  color: string;
  bgBadge: string;
  textBadge: string;
  borderBadge: string;
  subNiches: string[];
  description: string;
}

export const INDUSTRY_REGISTRY: Record<IndustryKey, IndustryMetadata> = {
  ENERGY_SOLAR: {
    key: "ENERGY_SOLAR",
    label: "Energy & Solar",
    shortLabel: "Energy & Solar",
    iconName: "SunMedium",
    color: "#f59e0b",
    bgBadge: "bg-amber-50",
    textBadge: "text-amber-800",
    borderBadge: "border-amber-200",
    subNiches: [
      "Residential Solar",
      "Commercial Solar",
      "Battery Storage & Off-Grid",
      "Heat Pumps & Electrification",
      "EV Charging",
      "Energy Audits & Retailing",
    ],
    description:
      "Residential and commercial solar PV, battery systems, heat pumps, and renewable energy.",
  },
  HOME_SERVICES_TRADES: {
    key: "HOME_SERVICES_TRADES",
    label: "Home Services & Trades",
    shortLabel: "Trades & Services",
    iconName: "Wrench",
    color: "#ea580c",
    bgBadge: "bg-orange-50",
    textBadge: "text-orange-700",
    borderBadge: "border-orange-200",
    subNiches: [
      "Plumbing",
      "HVAC / Air Con",
      "Electricians",
      "Roofing",
      "Pest Control",
      "Locksmiths",
      "Cleaning Services",
      "Painting",
      "Landscaping",
    ],
    description: "High-intent residential and local commercial trade services.",
  },
  LEGAL_FINANCIAL: {
    key: "LEGAL_FINANCIAL",
    label: "Legal & Financial Services",
    shortLabel: "Legal & Finance",
    iconName: "Scale",
    color: "#6366f1",
    bgBadge: "bg-indigo-50",
    textBadge: "text-indigo-700",
    borderBadge: "border-indigo-200",
    subNiches: [
      "Personal Injury",
      "Family & Criminal Law",
      "Conveyancing",
      "Accounting & Tax",
      "Mortgage Brokers",
      "Financial Advisory",
    ],
    description:
      "High-value professional client inquiries with longer conversion cycles.",
  },
  HEALTHCARE_MEDICAL: {
    key: "HEALTHCARE_MEDICAL",
    label: "Healthcare & Medical",
    shortLabel: "Healthcare",
    iconName: "HeartPulse",
    color: "#ec4899",
    bgBadge: "bg-pink-50",
    textBadge: "text-pink-700",
    borderBadge: "border-pink-200",
    subNiches: [
      "Dental & Orthodontics",
      "Physiotherapy",
      "Chiropractic",
      "Cosmetic Clinics",
      "Mental Health & Psychology",
      "Optometry",
    ],
    description: "Patient appointment bookings and healthcare inquiries.",
  },
  BUILDING_CONSTRUCTION: {
    key: "BUILDING_CONSTRUCTION",
    label: "Building & Construction",
    shortLabel: "Construction",
    iconName: "HardHat",
    color: "#3b82f6",
    bgBadge: "bg-blue-50",
    textBadge: "text-blue-700",
    borderBadge: "border-blue-200",
    subNiches: [
      "Custom Home Builders",
      "Commercial Builders",
      "Kitchen & Bath Renovations",
      "Concreting & Paving",
      "Pools & Spas",
      "Demolition & Excavation",
    ],
    description: "Large ticket residential and commercial building quotes.",
  },
  ECOMMERCE_RETAIL: {
    key: "ECOMMERCE_RETAIL",
    label: "E-Commerce & Retail",
    shortLabel: "E-Commerce",
    iconName: "ShoppingBag",
    color: "#10b981",
    bgBadge: "bg-emerald-50",
    textBadge: "text-emerald-700",
    borderBadge: "border-emerald-200",
    subNiches: [
      "DTC Apparel",
      "Supplements & Health",
      "Home & Living",
      "Consumer Electronics",
      "Beauty & Cosmetics",
    ],
    description:
      "Direct-to-consumer online store purchases and ROAS driven campaigns.",
  },
  PROFESSIONAL_B2B: {
    key: "PROFESSIONAL_B2B",
    label: "B2B & Corporate Services",
    shortLabel: "B2B Services",
    iconName: "Briefcase",
    color: "#0ea5e9",
    bgBadge: "bg-sky-50",
    textBadge: "text-sky-700",
    borderBadge: "border-sky-200",
    subNiches: [
      "Managed IT / MSP",
      "SaaS & Software",
      "Commercial Cleaning",
      "Logistics & Freight",
      "Recruitment & HR",
      "Management Consulting",
    ],
    description:
      "Corporate contracts, software demos, and business service inquiries.",
  },
  AUTOMOTIVE_TRANSPORT: {
    key: "AUTOMOTIVE_TRANSPORT",
    label: "Automotive & Transport",
    shortLabel: "Automotive",
    iconName: "Car",
    color: "#8b5cf6",
    bgBadge: "bg-purple-50",
    textBadge: "text-purple-700",
    borderBadge: "border-purple-200",
    subNiches: [
      "Auto Mechanics",
      "Panel Beaters & Smash Repair",
      "Car Detailing & Wrap",
      "Towing & Roadside",
      "Vehicle Dealerships",
    ],
    description:
      "Vehicle repair bookings, emergency towing, and automotive sales.",
  },
  REAL_ESTATE_PROPERTY: {
    key: "REAL_ESTATE_PROPERTY",
    label: "Real Estate & Property",
    shortLabel: "Real Estate",
    iconName: "Home",
    color: "#d97706",
    bgBadge: "bg-amber-100",
    textBadge: "text-amber-800",
    borderBadge: "border-amber-300",
    subNiches: [
      "Real Estate Agencies",
      "Property Management",
      "Buyers Agents",
      "Self Storage Units",
      "Commercial Property",
    ],
    description:
      "Property appraisals, rental inquiries, and real estate lead gen.",
  },
  EDUCATION_TRAINING: {
    key: "EDUCATION_TRAINING",
    label: "Education & Training",
    shortLabel: "Education",
    iconName: "GraduationCap",
    color: "#84cc16",
    bgBadge: "bg-lime-50",
    textBadge: "text-lime-700",
    borderBadge: "border-lime-200",
    subNiches: [
      "Trade Colleges & RTOs",
      "Private Tutoring",
      "Early Learning & Childcare",
      "Driving Schools",
      "Certification Courses",
    ],
    description: "Student enrollments, campus tours, and course inquiries.",
  },
  HOSPITALITY_EVENTS: {
    key: "HOSPITALITY_EVENTS",
    label: "Hospitality & Events",
    shortLabel: "Hospitality",
    iconName: "Utensils",
    color: "#f43f5e",
    bgBadge: "bg-rose-50",
    textBadge: "text-rose-700",
    borderBadge: "border-rose-200",
    subNiches: [
      "Event & Wedding Venues",
      "Catering Services",
      "Hotels & Accommodation",
      "Tourism & Experiences",
    ],
    description:
      "Event reservations, wedding bookings, and hospitality packages.",
  },
  OTHER: {
    key: "OTHER",
    label: "General / Other",
    shortLabel: "Other",
    iconName: "FolderTree",
    color: "#64748b",
    bgBadge: "bg-slate-100",
    textBadge: "text-slate-700",
    borderBadge: "border-slate-200",
    subNiches: ["General Unclassified"],
    description: "Specialized niche accounts and general campaigns.",
  },
};

export function getIndustryMeta(key?: string | null): IndustryMetadata {
  if (!key || !(key in INDUSTRY_REGISTRY)) {
    return INDUSTRY_REGISTRY.OTHER;
  }
  return INDUSTRY_REGISTRY[key as IndustryKey];
}

export function getAllIndustries(): IndustryMetadata[] {
  return Object.values(INDUSTRY_REGISTRY);
}
