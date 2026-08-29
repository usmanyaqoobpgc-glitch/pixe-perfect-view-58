export interface PlanSection {
  key: string;
  content: Record<string, unknown>;
  reasoning: string;
}

export interface BusinessInput {
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
}

export const SECTION_KEYS = [
  "idea_analysis", "target_audience", "competitor_research", "market_positioning",
  "offer_creation", "pricing_strategy", "brand_names", "roadmap", "milestones",
  "daily_tasks", "marketing_strategy", "social_content", "landing_page",
  "lead_generation", "customer_templates", "revenue_targets", "kpis",
  "weekly_analysis", "ai_recommendations",
] as const;

export function generatePlan(business: BusinessInput): PlanSection[] {
  const b = business;
  const budget = Number(b.budget || 0);
  const target = Number(b.revenue_target || 0);
  const model = b.business_model || "Services";
  const channels = b.marketing_channels || ["Social Media"];
  const skills = b.skills || [];
  const customer = b.target_customer || "general audience";

  return [
    {
      key: "idea_analysis",
      content: {
        summary: `Based on your idea: "${b.idea}", this appears to be a ${model.toLowerCase()} opportunity. With a budget of $${budget}, the focus should be on lean startup methods — validating demand before investing heavily.`,
        strengths: skills.length > 0 ? `Your skills in ${skills.join(", ")} are well-suited for this.` : "Consider what unique skills you bring.",
        risks: "Low budget means limited runway. Validate quickly and reinvest early revenue.",
        recommendation: "Start with a minimum viable offer, test with real customers, and iterate based on feedback.",
      },
      reasoning: "Analyzed the idea against budget, skills, and business model to assess feasibility and identify key risks.",
    },
    {
      key: "target_audience",
      content: {
        primary: customer,
        segments: [
          { name: "Early adopters", description: "People actively seeking a solution who are willing to try new options." },
          { name: "Budget-conscious", description: "Customers who want value but can't afford premium alternatives." },
        ],
        painPoints: ["Lack of affordable alternatives", "Complex existing solutions", "Poor customer service in market"],
        channels: "Look where your audience already spends time online — forums, social media groups, and communities.",
      },
      reasoning: "Derived audience segments from the target customer description and business model.",
    },
    {
      key: "competitor_research",
      content: {
        overview: `The ${model} space has established players but room for niche differentiation.`,
        competitors: [
          { name: "Established players", strength: "Brand recognition and resources", weakness: "Slow to innovate, generic offerings" },
          { name: "Indie/Small operators", strength: "Niche focus and personal touch", weakness: "Limited reach and resources" },
        ],
        opportunity: "Focus on underserved niches within the broader market.",
      },
      reasoning: "Generic competitor analysis based on the business model. Conduct specific competitor research for your exact niche.",
    },
    {
      key: "market_positioning",
      content: {
        position: "Affordable, focused, and personal — positioned as the practical alternative to expensive, bloated solutions.",
        differentiators: ["Price advantage", "Niche specialization", "Personal customer service"],
        valueProp: `A ${model} solution designed specifically for ${customer}, at a price point that respects their budget.`,
      },
      reasoning: "Positioning strategy based on budget constraints and target customer profile.",
    },
    {
      key: "offer_creation",
      content: {
        coreOffer: `A primary ${model} offering that solves the main pain point for ${customer}.`,
        upsells: ["Premium tier with additional features", "Done-for-you service option", "Bundle deals for multiple purchases"],
        guarantee: "Offer a satisfaction guarantee to reduce purchase friction for new customers.",
      },
      reasoning: "Offer structure designed to maximize initial conversion while building toward revenue target.",
    },
    {
      key: "pricing_strategy",
      content: {
        model: "Value-based pricing with an entry-level tier to reduce friction.",
        tiers: [
          { name: "Starter", price: `$${Math.max(9, Math.round(target / 100))}`, description: "Basic offering for new customers" },
          { name: "Pro", price: `$${Math.max(29, Math.round(target / 30))}`, description: "Full features for serious customers" },
        ],
        psychology: "Anchor with the Pro tier to make Starter feel like a great deal.",
        note: "These are AI-estimated starting prices. Test with real customers and adjust.",
      },
      reasoning: "Pricing derived from revenue target and typical market patterns. Always validate with real customer data.",
    },
    {
      key: "brand_names",
      content: {
        suggestions: [
          "ClearPath", "LaunchPad", "GrowthForge", "NimbleCo", "SparkStart",
          "QuickScale", "BaseCamp", "Trailhead",
        ],
        tips: "Check domain availability and trademark status before committing. Choose a name that's easy to spell and remember.",
      },
      reasoning: "Generated brand names based on the business idea and model. Verify availability before use.",
    },
    {
      key: "roadmap",
      content: {
        phases: [
          { phase: "Phase 1 (Weeks 1-4)", focus: "Validate and set up — create your offer, build a simple landing page, and get first customers." },
          { phase: "Phase 2 (Weeks 5-8)", focus: "Scale what works — double down on winning channels, optimize conversion, and reinvest revenue." },
          { phase: "Phase 3 (Weeks 9-12)", focus: "Optimize and expand — improve margins, add upsells, and build systems for sustainability." },
        ],
      },
      reasoning: "Roadmap structured around the deadline to ensure progressive milestones toward the revenue target.",
    },
    {
      key: "milestones",
      content: {
        items: [
          { day: 30, title: "First paying customer", description: "Launch your offer and acquire your first paying customer. Validate that people will pay." },
          { day: 60, title: "Consistent revenue", description: "Reach consistent weekly revenue. Identify your best marketing channel and double down." },
          { day: 90, title: "Revenue target progress", description: `Evaluate progress toward $${target} revenue target. Adjust strategy based on what's working.` },
        ],
      },
      reasoning: "Milestones set at 30/60/90 days to create checkpoints for measuring progress toward the revenue target.",
    },
    {
      key: "daily_tasks",
      content: {
        items: [
          { title: "Set up landing page", description: "Create a simple one-page site explaining your offer with a way to buy.", priority: "high" },
          { title: "Join 3 communities", description: "Find and participate in online communities where your target audience spends time.", priority: "medium" },
          { title: "Create social media profiles", description: "Set up professional profiles on your chosen marketing channels.", priority: "medium" },
          { title: "Reach out to 10 potential customers", description: "Directly contact potential customers to validate your offer.", priority: "high" },
          { title: "Create first piece of content", description: "Write or create content that demonstrates your expertise.", priority: "low" },
        ],
      },
      reasoning: "Tasks ordered by impact — validation and setup first, then growth activities.",
    },
    {
      key: "marketing_strategy",
      content: {
        approach: `Focus on ${channels.join(", ")} as primary channels. Start with organic methods before investing in paid acquisition.`,
        content: "Create educational and value-driven content that addresses your audience's pain points.",
        cadence: "Post consistently — aim for 3-5 pieces of content per week across your channels.",
        budget: budget > 0 ? `Allocate $${Math.round(budget * 0.3)} for initial marketing tests.` : "Start with organic (free) methods until you have revenue.",
      },
      reasoning: "Channel strategy based on your selected marketing channels and budget constraints.",
    },
    {
      key: "social_content",
      content: {
        ideas: [
          { type: "Educational", idea: "Share tips related to your niche that help your audience solve problems." },
          { type: "Behind-the-scenes", idea: "Document your journey of building this business — people love authentic stories." },
          { type: "Social proof", idea: "Share customer wins and testimonials as you get them." },
          { type: "Comparison", idea: "Compare your approach to alternatives to highlight your value." },
        ],
        schedule: "Aim for daily presence on at least one channel. Quality over quantity.",
      },
      reasoning: "Content ideas tailored to your marketing channels and audience.",
    },
    {
      key: "landing_page",
      content: {
        hero: `A clear headline that states what you do and who it's for. Subtitle with your key benefit.`,
        sections: ["Hero with clear value proposition", "Benefits (not just features)", "How it works", "Pricing", "FAQ", "Call to action"],
        cta: "Use a specific, action-oriented CTA like 'Get Started' or 'Claim Your Spot'.",
      },
      reasoning: "Landing page structure designed to convert visitors into customers.",
    },
    {
      key: "lead_generation",
      content: {
        strategy: "Combine inbound (content, SEO) with outbound (direct outreach, community participation).",
        tactics: [
          "Offer a free resource (guide, checklist, template) in exchange for email",
          "Participate in relevant online communities and provide value",
          "Direct outreach to potential customers with personalized messages",
        ],
        tools: "Start with free tools — a simple email list and social media. Add automation as you grow.",
      },
      reasoning: "Lead generation approach based on budget constraints — starting with free/organic methods.",
    },
    {
      key: "customer_templates",
      content: {
        templates: [
          { name: "Cold outreach", template: "Hi [Name], I noticed [specific thing about them]. I help [target audience] with [benefit]. Would you be open to a quick chat?" },
          { name: "Follow-up", template: "Hi [Name], just following up on my previous message. I'd love to hear your thoughts on [topic]." },
          { name: "Welcome", template: "Welcome! Thanks for choosing us. Here's what to expect next: [steps]. Reply if you have any questions." },
        ],
      },
      reasoning: "Templates designed for common customer communication scenarios.",
    },
    {
      key: "revenue_targets",
      content: {
        total: target,
        breakdown: [
          { month: "Month 1", target: Math.round(target * 0.2), description: "Focus on first customers and validation" },
          { month: "Month 2", target: Math.round(target * 0.35), description: "Scale what works and optimize" },
          { month: "Month 3", target: Math.round(target * 0.45), description: "Push toward target with refined strategy" },
        ],
        note: "These are goal-based estimates, not guaranteed revenue. Actual results depend on execution and market factors.",
      },
      reasoning: "Revenue targets distributed across the timeline to create progressive goals. These are estimates, not promises.",
    },
    {
      key: "kpis",
      content: {
        metrics: [
          { name: "Revenue", target: `$${target}`, frequency: "Weekly" },
          { name: "New leads", target: "10+ per week", frequency: "Weekly" },
          { name: "Conversion rate", target: "5%+", frequency: "Monthly" },
          { name: "Customer acquisition cost", target: `Under $${Math.max(10, Math.round(budget / 10))}`, frequency: "Monthly" },
          { name: "Average order value", target: `$${Math.max(20, Math.round(target / 50))}+`, frequency: "Monthly" },
        ],
      },
      reasoning: "KPIs selected to track progress toward the revenue target and business health.",
    },
    {
      key: "weekly_analysis",
      content: {
        review: "Each week, review: revenue earned, leads generated, tasks completed, and what worked vs. what didn't.",
        questions: [
          "Did I hit this week's revenue target?",
          "Which marketing channel brought the most leads?",
          "What's the biggest blocker right now?",
          "What should I focus on next week?",
        ],
      },
      reasoning: "Weekly review structure to enable data-driven adjustments to strategy.",
    },
    {
      key: "ai_recommendations",
      content: {
        recommendations: [
          "Start small and validate before scaling — don't invest heavily until you have proof of demand.",
          "Focus on one marketing channel first, master it, then expand to others.",
          "Talk to at least 5 potential customers per week to gather feedback and refine your offer.",
          "Track everything — you can't improve what you don't measure.",
        ],
        disclaimer: "These recommendations are AI-generated estimates and guidance. They are not guarantees of business success. Always validate with your own research and judgment.",
      },
      reasoning: "Recommendations based on best practices for low-budget startups. Adjust based on your specific situation and results.",
    },
  ];
}
