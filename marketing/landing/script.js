// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Simple email capture form handling (to be integrated with ConvertKit/Mailchimp)
function handleEmailSubmit(event, whitepaper) {
    event.preventDefault();
    const email = event.target.querySelector('input[type="email"]').value;

    // TODO: Integrate with ConvertKit/Mailchimp API
    // For now, show alert and log
    console.log(`Email submitted: ${email} for whitepaper: ${whitepaper}`);
    alert(`Thanks! We'll email you the "${whitepaper}" whitepaper at ${email}`);

    // Simulate download (replace with actual PDF link after email signup)
    // window.location.href = `/whitepapers/${whitepaper}.pdf`;
}

// Track button clicks for analytics (to be integrated with Plausible/PostHog)
function trackEvent(eventName, properties) {
    // TODO: Integrate with analytics platform
    console.log(`Event: ${eventName}`, properties);

    // Example integration with Plausible:
    // if (window.plausible) {
    //     plausible(eventName, {props: properties});
    // }
}

// Add click tracking to whitepaper buttons
document.querySelectorAll('.btn-whitepaper').forEach(button => {
    button.addEventListener('click', function(e) {
        const whitepaper = this.closest('.whitepaper-card').querySelector('h3').textContent;
        trackEvent('Whitepaper Download Click', { whitepaper });
    });
});

// Add click tracking to GitHub links
document.querySelectorAll('a[href*="github.com"]').forEach(link => {
    link.addEventListener('click', function() {
        trackEvent('GitHub Link Click', { url: this.href });
    });
});

// Sticky header on scroll
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    } else {
        header.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});
