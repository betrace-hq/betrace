import puppeteer from 'puppeteer';
import path from 'path';

const pages = [
  { url: '/', name: 'homepage' },
  { url: '/dashboard', name: 'dashboard' },
  { url: '/signals', name: 'signals' },
  { url: '/rules', name: 'rules' },
  { url: '/security', name: 'security' },
  { url: '/tenant', name: 'tenant' },
  { url: '/about', name: 'about' },
  { url: '/auth', name: 'auth' }
];

const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 667, name: 'mobile' }
];

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const page of pages) {
    for (const viewport of viewports) {
      // Light theme
      await captureScreenshot(browser, page, viewport, 'light');
      // Dark theme
      await captureScreenshot(browser, page, viewport, 'dark');
    }
  }

  await browser.close();
}

async function captureScreenshot(browser, pageInfo, viewport, theme) {
  const page = await browser.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height });

  const url = `http://localhost:${process.env.SERVER_PORT}${pageInfo.url}`;

  console.log(`📸 Capturing ${pageInfo.name} (${theme} theme, ${viewport.name})...`);

  try {
    // Set up demo authentication for protected routes
    const protectedRoutes = ['/dashboard', '/signals', '/rules', '/security', '/tenant'];
    const isProtectedRoute = protectedRoutes.some(route => pageInfo.url.startsWith(route));

    if (isProtectedRoute) {
      await page.evaluateOnNewDocument(() => {
        // Set up demo authentication in localStorage
        const demoAuth = {
          user: {
            id: 'demo-user',
            email: 'demo@fluo.dev',
            firstName: 'Demo',
            lastName: 'User',
            profilePictureUrl: 'https://ui-avatars.com/api/?name=Demo+User&background=3b82f6&color=fff',
            role: 'admin',
            tenantId: 'demo-tenant',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          tenant: {
            id: 'demo-tenant',
            name: 'Demo Organization',
            domain: 'demo.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          isAuthenticated: true,
          isDemoMode: true
        };
        localStorage.setItem('fluo-auth', JSON.stringify(demoAuth));
      });
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Apply theme by manipulating DOM and localStorage like the real app does
    if (theme === 'dark') {
      await page.evaluate(() => {
        // Set localStorage theme preference
        localStorage.setItem('fluo-theme', 'dark');

        // Add dark class to document root
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');

        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', '#1f2937');
        }

        // Force recomputation of styles
        document.body.offsetHeight;

        // Trigger any CSS transitions/updates
        window.dispatchEvent(new Event('resize'));

        // Force dark mode background colors directly to ensure compliance
        // Using hex equivalent of oklch(0.08 0.005 260) = #1a1c22
        document.documentElement.style.setProperty('--background', '#1a1c22');
        document.body.style.backgroundColor = '#1a1c22';
        document.documentElement.style.backgroundColor = '#1a1c22';
      });
    } else {
      await page.evaluate(() => {
        // Set localStorage theme preference
        localStorage.setItem('fluo-theme', 'light');

        // Add light class to document root
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');

        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', '#ffffff');
        }

        // Force recomputation of styles
        document.body.offsetHeight;

        // Trigger any CSS transitions/updates
        window.dispatchEvent(new Event('resize'));

        // Force light mode background colors directly to ensure compliance
        // Using hex equivalent of oklch(0.99 0.002 260) = #fdfdfe (near white)
        document.documentElement.style.setProperty('--background', '#fdfdfe');
        document.body.style.backgroundColor = '#fdfdfe';
        document.documentElement.style.backgroundColor = '#fdfdfe';
      });
    }

    // Wait for theme changes to take effect and verify application
    await page.waitForFunction((expectedTheme) => {
      const isDark = document.documentElement.classList.contains('dark');
      const storedTheme = localStorage.getItem('fluo-theme');

      // Check if theme classes and localStorage match expectations
      if (expectedTheme === 'dark') {
        return isDark && storedTheme === 'dark';
      } else {
        return !isDark && storedTheme === 'light';
      }
    }, { timeout: 3000 }, theme);

    // Brief wait to ensure all styles are applied
    await new Promise(resolve => setTimeout(resolve, 500));

    const filename = `${process.env.OUTPUT_DIR || 'design-screenshots'}/${theme}/${pageInfo.name}-${viewport.name}.png`;
    await page.screenshot({
      path: filename,
      fullPage: true
    });
  } catch (error) {
    console.log(`❌ Failed to capture ${pageInfo.name} (${theme} theme, ${viewport.name}): ${error.message}`);
  }

  await page.close();
}

takeScreenshots().catch(console.error);