# BeTrace Landing Page

Static landing page for BeTrace whitepapers, deployed via GitHub Pages.

## 🚀 Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to `main`.

**Live URL:** https://betracehq.github.io/betrace/ (or your custom domain)

## 📁 Structure

```
marketing/landing/
├── index.html              # Main landing page
├── economics.html          # Economics whitepaper download
├── invariants.html         # Invariants whitepaper download
├── security.html           # Security whitepaper download
├── compliance.html         # Compliance whitepaper download
├── styles.css              # All styles
├── script.js               # JavaScript (analytics, email capture)
└── README.md               # This file
```

## 🛠️ Local Development

Open `index.html` in your browser:

```bash
cd marketing/landing
open index.html  # macOS
# or
python3 -m http.server 8000  # Start local server
```

Then visit http://localhost:8000

## 📧 Email Integration (TODO)

Currently, email forms show alerts and redirect to GitHub. To enable real email capture:

### Option 1: ConvertKit

1. Sign up at convertkit.com
2. Create forms for each whitepaper
3. Update `script.js`:

```javascript
fetch('https://api.convertkit.com/v3/forms/YOUR_FORM_ID/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        api_key: 'YOUR_API_KEY',
        email: email,
        tags: ['Downloaded: Economics']
    })
});
```

### Option 2: Mailchimp

1. Sign up at mailchimp.com
2. Create audiences and tags
3. Use Mailchimp's form embed code

### Option 3: Netlify Forms

1. Deploy to Netlify (instead of GitHub Pages)
2. Add `netlify` attribute to forms
3. Forms work automatically with Netlify

## 📊 Analytics Integration (TODO)

To track pageviews and conversions:

### Option 1: Plausible (Privacy-Friendly)

Add to `<head>`:
```html
<script defer data-domain="betracehq.github.io" src="https://plausible.io/js/script.js"></script>
```

### Option 2: PostHog (Product Analytics)

Add to `<head>`:
```html
<script>
  !function(t,e){...}(window,document,"posthog");
  posthog.init('YOUR_API_KEY',{api_host:'https://app.posthog.com'})
</script>
```

## 🎨 Customization

### Update Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --color-primary: #3b82f6;      /* Blue */
    --color-secondary: #10b981;    /* Green */
    --color-text: #1f2937;         /* Dark gray */
}
```

### Update Content

- **Hero:** Edit `index.html` lines 20-60
- **Stats:** Edit `index.html` lines 25-40
- **Whitepapers:** Edit `index.html` lines 100-200

## 🔗 Custom Domain (Optional)

To use custom domain (e.g., betrace.dev):

1. Add `CNAME` file to `marketing/landing/`:
```
betrace.dev
```

2. Configure DNS:
   - A record: 185.199.108.153
   - A record: 185.199.109.153
   - A record: 185.199.110.153
   - A record: 185.199.111.153

3. Enable in GitHub Settings → Pages → Custom domain

## ✅ Pre-Launch Checklist

Before launching publicly:

- [ ] Replace email form alerts with real email capture (ConvertKit/Mailchimp)
- [ ] Add analytics (Plausible or PostHog)
- [ ] Generate PDFs from markdown whitepapers
- [ ] Host PDFs on CDN or GitHub releases
- [ ] Update download links to actual PDFs
- [ ] Test email sequence (3 emails)
- [ ] Load test landing page (simulate 10K visitors)
- [ ] Set up custom domain (optional)

## 📈 Success Metrics

Track these metrics after launch:

**Volume:**
- Landing page visitors
- Whitepaper downloads (email signups)
- GitHub stars from landing page

**Quality:**
- Email open rate (target: >40%)
- Click-through rate (target: >10%)
- Bounce rate (target: <60%)

**Conversion:**
- Email signup → GitHub star (target: 25%)
- Email signup → `nix run .#dev` (track via analytics)
- Email signup → Sales inquiry (target: 5%)

## 🚨 Known Limitations

**Current Implementation:**
- ✅ Static HTML/CSS/JS (fast, free hosting)
- ✅ Mobile responsive
- ✅ SEO-optimized meta tags
- ❌ No real email capture (shows alerts, links to GitHub)
- ❌ No analytics tracking
- ❌ No PDF hosting (links to GitHub markdown)

**To Fix:**
1. Integrate ConvertKit/Mailchimp (4 hours)
2. Add Plausible analytics (1 hour)
3. Generate PDFs from markdown (2 hours)
4. Host PDFs on CDN (1 hour)

**Total time to production-ready:** 8 hours

## 📚 Related Documents

- [PRE-LAUNCH-VALIDATION-REPORT.md](../PRE-LAUNCH-VALIDATION-REPORT.md) - Content audit
- [PRE-LAUNCH-CHECKLIST-COMPLETE.md](../PRE-LAUNCH-CHECKLIST-COMPLETE.md) - Launch readiness
- [EMAIL-NURTURE-SEQUENCE.md](../EMAIL-NURTURE-SEQUENCE.md) - 3-email templates
- [docs/feature-status.md](../../docs/feature-status.md) - Shipped vs. not shipped

## 🎉 Launch Timeline

**Week 1 (Infrastructure):**
- Day 1: Deploy to GitHub Pages ✅
- Day 2: Integrate email capture
- Day 3: Add analytics
- Day 4: Generate PDFs
- Day 5: Test end-to-end
- Day 6: Load test
- Day 7: Buffer

**Week 2 (Soft Launch):**
- Monday: Launch with 1 whitepaper
- Monitor: Traffic, signups, issues
- Fix: Any problems discovered

**Week 3+:**
- Launch remaining whitepapers
- Iterate based on data
