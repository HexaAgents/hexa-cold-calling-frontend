"use client";

import { useState, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  role: string;
  category: string;
  angle: string;
  template: string;
}

const TEMPLATES: Template[] = [
  {
    id: "ceo",
    role: "CEO / President / Owner / MD",
    category: "Executive",
    angle: "Strategic growth and competitive advantage",
    template: `Hi [Prospect Name],

I came across [Company Name] and was impressed by what you've built in the industrial distribution space. Companies like yours are at an interesting inflection point — the distributors gaining market share right now are the ones automating their outbound sales and lead qualification processes.

We work with industrial distributors to help them systematically identify and connect with high-value prospects, turning what's usually a manual, time-consuming process into a scalable pipeline. One of our clients, a [Specific Detail — e.g., "mid-size electrical supplies distributor"], added 40+ qualified opportunities in their first quarter using our approach.

I'd love to share how we're helping distribution leaders like yourself grow revenue without growing headcount. Would a brief conversation be worth your time this week?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "coo",
    role: "COO / VP Operations",
    category: "Executive",
    angle: "Operational efficiency and process scalability",
    template: `Hi [Prospect Name],

I've been researching [Company Name] and noticed you're leading operations in a space where efficiency is everything. One challenge I keep hearing from COOs in industrial distribution is that their sales teams spend too much time on manual prospecting and not enough time closing deals with the right accounts.

We help distributors operationalize their outbound sales — replacing inconsistent cold outreach with a structured, data-driven system that identifies the highest-value prospects and engages them systematically. The result is a repeatable process that scales without adding operational complexity.

For a company of [Company Name]'s size, the impact is usually measurable within 60 days: shorter sales cycles, higher conversion rates, and a pipeline your team can actually forecast against.

Would you be open to a 15-minute call to explore whether this fits your operational priorities?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "cfo",
    role: "CFO / VP Finance",
    category: "Executive",
    angle: "ROI, cost per acquisition, and revenue predictability",
    template: `Hi [Prospect Name],

I'll keep this brief since I know your time is valuable. I work with CFOs at industrial distributors who are looking for more predictable revenue growth without proportionally increasing their sales headcount costs.

The math that usually gets their attention: most distributors spend $80–120K+ per sales rep (salary, benefits, travel) but struggle with inconsistent pipeline generation. We help companies like [Company Name] build a systematized lead qualification and outreach engine that generates qualified sales conversations at a fraction of the cost of additional hires.

Our clients typically see a 3–5x return on investment within the first two quarters. I'd be happy to walk through the unit economics specific to your distribution vertical.

Worth a 15-minute conversation?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "vp-supply-chain",
    role: "VP / Director of Supply Chain",
    category: "Supply Chain & Procurement",
    angle: "Vendor diversification and supply chain relationships",
    template: `Hi [Prospect Name],

I noticed you're heading up supply chain at [Company Name] — a critical role in today's distribution landscape. I wanted to reach out because we work with industrial distributors on something adjacent to your world: helping them build stronger downstream relationships by identifying and connecting with the right buyers more efficiently.

Many supply chain leaders I speak with are also involved in strategic growth discussions — finding new customers who align with your existing product lines and vendor relationships is ultimately about maximizing the value of your supply chain investments.

We've helped distributors in [Specific Detail — e.g., "the pipe, valve, and fittings space"] expand their customer base by 25%+ by systematically targeting companies that are a natural fit for their product mix.

I'd love to share how this could complement [Company Name]'s growth strategy. Open to connecting?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "vp-procurement",
    role: "VP / Director of Procurement / Purchasing",
    category: "Supply Chain & Procurement",
    angle: "Vendor evaluation and cost-effective growth tools",
    template: `Hi [Prospect Name],

I know procurement leaders are constantly evaluating tools and partnerships that deliver measurable value. I wanted to introduce what we're doing for industrial distributors like [Company Name] — not on the buying side, but on the selling side.

We help distributors build a cost-effective, scalable outbound sales engine. Instead of hiring more sales reps or relying on trade shows, our platform uses data-driven lead scoring and automated outreach to fill your sales pipeline with qualified prospects.

The procurement angle that resonates most: our solution typically costs less than 10% of a single sales hire while generating comparable pipeline volume. For a procurement-minded leader, the ROI case is compelling.

Would it make sense to connect for a quick call? I can share specific numbers from distributors in your space.

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "purchasing-manager",
    role: "Purchasing Manager",
    category: "Supply Chain & Procurement",
    angle: "Practical tool evaluation and budget efficiency",
    template: `Hi [Prospect Name],

Quick question — is [Company Name] actively looking for ways to generate more sales opportunities without significantly increasing your outbound sales budget?

I work with industrial distributors who need a more efficient approach to finding and qualifying new customers. Our platform automates the prospect identification and outreach process, so your sales team spends their time on conversations that actually convert instead of cold-calling from outdated lists.

What makes this relevant for purchasing-minded professionals: we've structured our pricing to deliver clear, trackable ROI — most clients see results within the first 30–60 days and can tie every dollar spent directly to pipeline generated.

Happy to share a quick demo if this sounds relevant to what [Company Name] is working on.

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "director-operations",
    role: "Director of Operations / Plant Manager",
    category: "Operations & Sales",
    angle: "Reducing sales process waste and improving throughput",
    template: `Hi [Prospect Name],

As someone running operations at [Company Name], you know better than anyone that waste in any process — including sales — directly impacts the bottom line. I wanted to reach out because we help industrial distributors eliminate the inefficiency in their outbound sales efforts.

Most distributors I work with have talented sales teams that are bogged down with manual prospecting: researching companies, finding contacts, making cold calls to unqualified leads. It's the sales equivalent of a bottleneck on a production line.

We automate the front end of that process — identifying high-fit prospects, scoring them, and queuing them for your team — so every call your reps make is to someone worth talking to. Distributors using our system report 2–3x more productive selling time per rep.

Would a brief conversation make sense to see if this could improve your team's throughput?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "director-sales-ops",
    role: "Director of Sales Operations",
    category: "Operations & Sales",
    angle: "Pipeline velocity and sales process optimization",
    template: `Hi [Prospect Name],

As the person driving sales operations at [Company Name], you're probably always looking for ways to increase pipeline velocity and rep productivity. That's exactly the problem we solve for industrial distributors.

Our platform sits at the top of your sales funnel: we use AI-powered lead scoring to identify which companies in your target market are the best fit, then systematize the outreach process so your reps start conversations with pre-qualified prospects instead of spraying and praying.

What sales ops leaders love most: full visibility into the pipeline from first touch to qualified opportunity, with data you can actually use to forecast and optimize. One client's Director of Sales Ops told us it "turned their sales process from an art into a science."

I'd love to show you a quick walkthrough tailored to [Company Name]'s market. When works best for a 15-minute call?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "operations-manager",
    role: "Operations Manager",
    category: "Operations & Sales",
    angle: "Process improvement and team efficiency",
    template: `Hi [Prospect Name],

I noticed you're managing operations at [Company Name] and wanted to reach out about something that's been a game-changer for ops managers at similar industrial distributors.

The challenge I keep hearing: your sales team's prospecting process is manual, inconsistent, and hard to measure. Reps spend hours researching leads, and there's no standardized way to qualify whether a prospect is even worth calling.

We built a platform that solves exactly this — automated prospect scoring, organized call queues, and structured follow-up workflows. It brings the same process discipline you'd apply to warehouse ops or logistics to your sales development function.

The ops managers who use our system tell us it's like finally having a dashboard for their sales pipeline. Would it be worth seeing a quick demo?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "sales-manager",
    role: "Sales Manager",
    category: "Operations & Sales",
    angle: "Helping reps hit quota with better leads",
    template: `Hi [Prospect Name],

Managing a sales team in industrial distribution is tough — your reps need to be product experts, relationship builders, AND prospectors all at once. What if you could take the prospecting burden off their plate entirely?

We work with sales managers at distributors like [Company Name] to solve the #1 time killer: finding and qualifying new accounts. Our platform identifies companies that match your ideal customer profile, scores them based on fit, and serves them up to your team in a ready-to-call queue.

The result? Your reps spend their day doing what they're best at — selling — instead of digging through directories and LinkedIn. Sales managers using our system typically see a 40–60% increase in meaningful sales conversations per rep per week.

I'd love to show you how this could help your team crush their targets. Free for a quick call this week?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "it-director",
    role: "IT Director / VP IT",
    category: "Support Functions",
    angle: "Low-overhead SaaS, no integration complexity",
    template: `Hi [Prospect Name],

I know IT leaders at distributors like [Company Name] get pitched new software constantly, so I'll be upfront: our platform is designed to require zero IT involvement to deploy and maintain.

We provide a cloud-based sales development platform for industrial distributors — AI-powered lead scoring, automated outreach workflows, and CRM-ready pipeline data. It runs as a standalone SaaS application with no on-prem infrastructure, no ERP integration required, and no custom development needed.

The reason I'm reaching out to you specifically: when our sales team talks to your colleagues in business development, they sometimes have IT questions about security, data handling, and SSO capabilities. I'd rather address those proactively than have them become a blocker.

Would you be open to a brief technical overview? Happy to make it as detailed or high-level as you prefer.

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "warehouse-manager",
    role: "Warehouse / Distribution Manager",
    category: "Support Functions",
    angle: "Driving more volume through existing distribution infrastructure",
    template: `Hi [Prospect Name],

This might be a slightly unconventional outreach for a warehouse/distribution leader, but hear me out — what we do directly impacts your world.

We help industrial distributors like [Company Name] systematically grow their customer base, which means more orders flowing through your distribution operation. The distributors we work with typically see a 20–30% increase in new account acquisition within the first two quarters.

For distribution and warehouse managers, that translates to more predictable volume growth — the kind you can plan capacity and staffing around, rather than the feast-or-famine cycles that come from inconsistent sales efforts.

If [Company Name] is focused on growth, it might be worth connecting so I can share how we're helping distributors in your space build more consistent sales pipelines. Open to a quick conversation?

Best,
[Your Name]
[Your Company]`,
  },
  {
    id: "controller",
    role: "Controller / Accounting Manager",
    category: "Support Functions",
    angle: "Measurable ROI and revenue growth tracking",
    template: `Hi [Prospect Name],

As the financial gatekeeper at [Company Name], you probably want to see clear numbers before any new investment gets approved. I respect that, so let me lead with the math.

We help industrial distributors generate qualified sales opportunities at a cost that's typically 70–80% less than hiring additional sales reps. Our platform automates lead identification and outreach, turning what's usually an unpredictable expense (trade shows, cold calling campaigns, sales hires) into a fixed, measurable cost with trackable returns.

For a distributor of [Company Name]'s profile, our clients typically see $5–10 in pipeline value for every $1 invested, with results visible within the first 60 days. Every touchpoint and outcome is tracked, so you get month-over-month reporting on exactly what the investment is producing.

Would it be helpful to see a cost-benefit analysis tailored to your business? Happy to put one together.

Best,
[Your Name]
[Your Company]`,
  },
];

const CATEGORIES = ["Executive", "Supply Chain & Procurement", "Operations & Sales", "Support Functions"];

export default function LinkedInTemplatesPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <TemplatesContent />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function TemplatesContent() {
  const [selectedId, setSelectedId] = useState(TEMPLATES[0].id);
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const selected = TEMPLATES.find((t) => t.id === selectedId) || TEMPLATES[0];
  const currentText = editedTexts[selected.id] ?? selected.template;
  const isEdited = editedTexts[selected.id] !== undefined;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = currentText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [currentText]);

  const handleReset = () => {
    setEditedTexts((prev) => {
      const next = { ...prev };
      delete next[selected.id];
      return next;
    });
  };

  const handleTextChange = (value: string) => {
    setEditedTexts((prev) => ({ ...prev, [selected.id]: value }));
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="flex h-full">
      {/* Role selector panel */}
      <div className="w-[260px] flex-shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
        <div className="p-4 pb-2">
          <h2 className="text-sm font-semibold">LinkedIn Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">13 role-specific outreach messages</p>
        </div>
        <nav className="px-2 pb-4">
          {CATEGORIES.map((cat) => {
            const catTemplates = TEMPLATES.filter((t) => t.category === cat);
            const isCollapsed = collapsedCategories[cat];
            return (
              <div key={cat} className="mb-1">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {cat}
                  <ChevronDown
                    size={12}
                    className={cn("transition-transform", isCollapsed && "-rotate-90")}
                  />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {catTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                          selectedId === t.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {t.role}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Template content panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{selected.role}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Angle: {selected.angle}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs tabular-nums">
                {currentText.trim().split(/\s+/).filter(Boolean).length} words
              </Badge>
              <Badge variant="outline" className="text-xs tabular-nums">
                {currentText.length} chars
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {selected.category}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText size={13} />
                <span>Edit template below, then copy to clipboard</span>
              </div>
              <div className="flex items-center gap-2">
                {isEdited && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw size={12} /> Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              value={currentText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[400px] resize-y text-sm leading-relaxed p-4 font-sans"
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Fill in these blanks before sending:</p>
            <div className="flex flex-wrap gap-1.5">
              {["[Prospect Name]", "[Company Name]", "[Your Name]", "[Your Company]", "[Specific Detail]"].map((placeholder) => (
                <Badge key={placeholder} variant="outline" className="text-xs font-mono">
                  {placeholder}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
