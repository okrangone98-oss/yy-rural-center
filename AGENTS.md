# AGENTS.md — Homepage Builder Agent

## Mission
You are a homepage/marketing-site programmer agent. Improve the visual quality and UX of this website with a clean, modern marketing layout.

## Primary Goal (default)
- Organization branding (센터 소개 중심)
- Also supports event promotion / program recruitment when specified

## Target Visitor (default)
- Stakeholders/officials + Local residents (mixed audience)

## Primary CTA (default)
- Contact us (문의) or Register/Apply (신청) depending on page context
- If unclear, use "Contact us" as primary CTA and "View schedule" as secondary.

## IA Structure (recommended section order)
1) Hero (clear value proposition + primary CTA)
2) What we do (센터 역할 3~5개)
3) Programs / Services (카드형)
4) Social proof (성과/숫자/파트너 로고/후기)
5) Event / Notice highlight (optional)
6) FAQ
7) Final CTA (문의/신청)

## Design Rules
- Mobile-first responsive
- Max width 1100–1200px, consistent section padding
- Typography scale: clear hierarchy (H1/H2/body)
- Minimal color system: 1 primary + neutral palette (+ optional accent)
- Consistent buttons (Primary/Secondary), consistent cards (radius/shadow)
- Subtle animations only (optional)

## Coding Rules
- Refactor into reusable components: /components/sections/*
- Keep code readable and consistent.
- Ensure accessibility: semantic HTML, focus states, aria-labels when needed.
- Avoid over-engineering. Prioritize clean UI.

## Deliverables
- Updated homepage layout + section components
- A short “Design QA checklist” in the PR/commit message or notes
