export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'support';
  preferences: Record<string, unknown>;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type WorkspaceType =
  | 'startup' | 'company' | 'small_business' | 'agency' | 'ecommerce'
  | 'school' | 'college' | 'university' | 'creator' | 'marketing_team'
  | 'software_company' | 'professional_services' | 'other';

export interface Business {
  id: string;
  user_id: string;
  name: string;
  idea: string;
  budget: number;
  country: string | null;
  target_customer: string | null;
  skills: string[] | null;
  available_time_hours_per_week: number | null;
  business_model: string | null;
  revenue_target: number;
  target_deadline: string | null;
  marketing_channels: string[] | null;
  status: 'planning' | 'active' | 'paused' | 'archived';
  workspace_type: WorkspaceType;
  created_at: string;
  updated_at: string;
}

export interface BusinessPlan {
  id: string;
  business_id: string;
  section_key: string;
  content: Record<string, unknown>;
  reasoning: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  target_day: 30 | 60 | 90;
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes: string | null;
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lifetime_value: number;
  status: 'active' | 'churned' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface RevenueRecord {
  id: string;
  business_id: string;
  type: 'revenue' | 'expense';
  amount: number;
  description: string;
  category: string | null;
  record_date: string;
  is_estimate: boolean;
  created_at: string;
}

export interface MarketingContent {
  id: string;
  business_id: string;
  channel: string;
  content_type: string;
  title: string;
  body: string | null;
  status: 'idea' | 'drafted' | 'scheduled' | 'published';
  scheduled_date: string | null;
  created_at: string;
}

export interface WebsiteDraft {
  id: string;
  business_id: string;
  content: WebsiteContent;
  is_published: boolean;
  published_url: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WebsiteContent {
  heroTitle?: string;
  heroSubtitle?: string;
  heroCta?: string;
  benefits?: { title: string; description: string }[];
  features?: { title: string; description: string }[];
  pricing?: { name: string; price: string; features: string[] }[];
  testimonials?: { name: string; quote: string }[];
  faq?: { question: string; answer: string }[];
  contactEmail?: string;
  contactPhone?: string;
  brandName?: string;
  primaryColor?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  event_description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIAgentRun {
  id: string;
  business_id: string | null;
  user_id: string;
  agent_type: 'market_research' | 'competitor' | 'business_strategy' | 'marketing' | 'sales' | 'analytics' | 'optimization';
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export const PLAN_SECTIONS = [
  'idea_analysis',
  'target_audience',
  'competitor_research',
  'market_positioning',
  'offer_creation',
  'pricing_strategy',
  'brand_names',
  'roadmap',
  'milestones',
  'daily_tasks',
  'marketing_strategy',
  'social_content',
  'landing_page',
  'lead_generation',
  'customer_templates',
  'revenue_targets',
  'kpis',
  'weekly_analysis',
  'ai_recommendations',
] as const;

export const SECTION_LABELS: Record<string, string> = {
  idea_analysis: 'Business Idea Analysis',
  target_audience: 'Target Audience',
  competitor_research: 'Competitor Research',
  market_positioning: 'Market Positioning',
  offer_creation: 'Offer Creation',
  pricing_strategy: 'Pricing Strategy',
  brand_names: 'Brand Name Suggestions',
  roadmap: 'Business Roadmap',
  milestones: '30/60/90-Day Milestones',
  daily_tasks: 'Daily Tasks',
  marketing_strategy: 'Marketing Strategy',
  social_content: 'Social Media Content Ideas',
  landing_page: 'Landing Page Content',
  lead_generation: 'Lead Generation Strategy',
  customer_templates: 'Customer Communication Templates',
  revenue_targets: 'Revenue Targets',
  kpis: 'KPI Tracking',
  weekly_analysis: 'Weekly Performance Analysis',
  ai_recommendations: 'AI Recommendations',
};
