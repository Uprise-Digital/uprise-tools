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

// Rule-based classification engine
export function classifyAccountByRules(
  name: string,
  websiteUrl?: string | null,
  campaigns: string[] = [],
): { industry: IndustryKey; subNiche: string } | null {
  const text =
    `${name} ${websiteUrl || ""} ${campaigns.join(" ")}`.toLowerCase();

  // 1. Energy & Solar
  if (
    /\b(solar|battery|batteries|inverter|solar panel|solar system|ev charger|ev charging|renewable|clean energy|off-grid|heat pump solar|solar power)\b/i.test(
      text,
    )
  ) {
    if (
      /\b(battery|batteries|storage|off-grid|tesla powerwall)\b/i.test(text)
    ) {
      return {
        industry: "ENERGY_SOLAR",
        subNiche: "Battery Storage & Off-Grid",
      };
    }
    if (/\b(commercial|business solar|industrial)\b/i.test(text)) {
      return { industry: "ENERGY_SOLAR", subNiche: "Commercial Solar" };
    }
    if (/\b(ev|charger|charging)\b/i.test(text)) {
      return { industry: "ENERGY_SOLAR", subNiche: "EV Charging" };
    }
    return { industry: "ENERGY_SOLAR", subNiche: "Residential Solar" };
  }

  // 2. Home Services & Trades
  if (/\b(plumb|gas|drain|blocked|hot water|leak|tap|pipe)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Plumbing & Gas" };
  }
  if (/\b(electric|sparky|switchboard|rewir|power|lighting)\b/i.test(text)) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "Electricians",
    };
  }
  if (/\b(roof|gutter|metal roof|tile roof|restoration|fascia)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Roofing & Gutters" };
  }
  if (
    /\b(air con|aircon|air conditioning|hvac|heat pump|cooling|ducted|refrigeration)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "HVAC & Air Conditioning",
    };
  }
  if (/\b(pest|termite|rodent|possum|fumigat|bug|wasp)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Pest Control" };
  }
  if (/\b(locksmith|key|lock|safe|deadbolt|rekey)\b/i.test(text)) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Locksmiths" };
  }
  if (
    /\b(clean|carpet|bond clean|pressure wash|window clean|house clean)\b/i.test(
      text,
    )
  ) {
    return { industry: "HOME_SERVICES_TRADES", subNiche: "Cleaning Services" };
  }
  if (/\b(paint|painter|decorat)\b/i.test(text)) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "Painting & Decorating",
    };
  }
  if (
    /\b(landscape|tree|arborist|garden|lawn|fenc|deck|pergola)\b/i.test(text)
  ) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "Landscaping & Outdoor",
    };
  }
  if (
    /\b(trades|handyman|glaz|glass|tiler|tiling|plaster|carpenter)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HOME_SERVICES_TRADES",
      subNiche: "General Trade Services",
    };
  }

  // 3. Legal & Financial
  if (
    /\b(law|legal|solicitor|attorney|injury|compensation|criminal|divorce|family law|probate|estate law|litigat)\b/i.test(
      text,
    )
  ) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Legal & Law Firms" };
  }
  if (/\b(conveyanc|settlement)\b/i.test(text)) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Conveyancing" };
  }
  if (/\b(account|tax|bookkeep|cpa|audit|payroll|smsf)\b/i.test(text)) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Accounting & Tax" };
  }
  if (
    /\b(mortgage|broker|finance|loan|wealth|financial plan|superannuation)\b/i.test(
      text,
    )
  ) {
    return { industry: "LEGAL_FINANCIAL", subNiche: "Mortgage & Wealth" };
  }

  // 4. Healthcare & Medical
  if (
    /\b(dent|ortho|teeth|invisalign|smile|veneer|dental|implant)\b/i.test(text)
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Dental & Orthodontics",
    };
  }
  if (/\b(physio|physical therapy|rehab|occupational therapy)\b/i.test(text)) {
    return { industry: "HEALTHCARE_MEDICAL", subNiche: "Physiotherapy" };
  }
  if (/\b(chiro|chiropract|osteopath|massage)\b/i.test(text)) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Chiropractic & Wellness",
    };
  }
  if (
    /\b(cosmetic|botox|filler|laser|skin clinic|dermatolog|aesthet|plastic surg)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Cosmetic & Aesthetics",
    };
  }
  if (
    /\b(psycholog|therap|counsel|mental health|adhd|psychiatr)\b/i.test(text)
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Mental Health & Psychology",
    };
  }
  if (/\b(optom|eye|vision|lasik|glasses|contact lens)\b/i.test(text)) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Optometry & Eye Care",
    };
  }
  if (
    /\b(doctor|clinic|medical|gp|podiatry|hearing|audiolog|health)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HEALTHCARE_MEDICAL",
      subNiche: "Medical Clinics & Health",
    };
  }

  // 5. Building & Construction
  if (
    /\b(builder|construction|custom home|renovat|extension|architect)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "BUILDING_CONSTRUCTION",
      subNiche: "Home Builders & Construction",
    };
  }
  if (/\b(concrete|paving|driveway|slab|asphalt)\b/i.test(text)) {
    return {
      industry: "BUILDING_CONSTRUCTION",
      subNiche: "Concreting & Paving",
    };
  }
  if (/\b(pool|spa|swimming pool|fibreglass pool)\b/i.test(text)) {
    return { industry: "BUILDING_CONSTRUCTION", subNiche: "Pools & Spas" };
  }
  if (/\b(demolition|earthmov|excavat|scaffold|steel)\b/i.test(text)) {
    return {
      industry: "BUILDING_CONSTRUCTION",
      subNiche: "Commercial Construction & Heavy",
    };
  }

  // 6. Automotive & Transport
  if (
    /\b(mechanic|car service|auto repair|brake|clutch|logbook|tyre|tire)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Mechanics & Auto Service",
    };
  }
  if (
    /\b(smash|panel beat|dent repair|spray paint|accident repair)\b/i.test(text)
  ) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Panel Beaters & Smash Repair",
    };
  }
  if (/\b(detail|wrap|tint|ceramic coating|car wash)\b/i.test(text)) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Car Detailing & Wrap",
    };
  }
  if (/\b(tow|towing|breakdown|roadside)\b/i.test(text)) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Towing & Roadside",
    };
  }
  if (
    /\b(car hire|car rental|rental car|dealership|used car|fleet)\b/i.test(text)
  ) {
    return {
      industry: "AUTOMOTIVE_TRANSPORT",
      subNiche: "Dealerships & Rentals",
    };
  }

  // 7. Real Estate & Property
  if (
    /\b(real estate|realty|property manage|buyers agent|rent|lease|appraisal|estate agent)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "REAL_ESTATE_PROPERTY",
      subNiche: "Real Estate Agencies",
    };
  }
  if (/\b(storage|self storage|container storage)\b/i.test(text)) {
    return { industry: "REAL_ESTATE_PROPERTY", subNiche: "Self Storage" };
  }

  // 8. E-Commerce & Retail
  if (
    /\b(shop|store|brand|apparel|clothing|fashion|shoe|supplement|jewelry|boutique|ecommerce|cart|order|retail|merch)\b/i.test(
      text,
    )
  ) {
    return { industry: "ECOMMERCE_RETAIL", subNiche: "DTC & Retail Store" };
  }

  // 9. B2B & Corporate Services
  if (
    /\b(msp|it support|managed it|cybersecurity|software|saas|cloud|b2b|consult|freight|logistics|commercial clean|recruitment|agency|marketing)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "PROFESSIONAL_B2B",
      subNiche: "B2B & Professional Services",
    };
  }

  // 10. Education & Training
  if (
    /\b(college|rto|course|training|tutor|childcare|daycare|driving school|academy|school|university|learn)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "EDUCATION_TRAINING",
      subNiche: "Education & Courses",
    };
  }

  // 11. Hospitality & Events
  if (
    /\b(venue|wedding|cater|hotel|resort|restaurant|bar|cafe|event|party hire|photo|video|travel|tour)\b/i.test(
      text,
    )
  ) {
    return {
      industry: "HOSPITALITY_EVENTS",
      subNiche: "Hospitality & Events",
    };
  }

  return null;
}
