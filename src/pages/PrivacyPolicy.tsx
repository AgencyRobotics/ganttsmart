import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

export default function PrivacyPolicy() {
  useTheme();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-bg-primary/90 backdrop-blur-sm border-b border-border-primary px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm font-bold tracking-tight text-text-primary hover:text-accent transition-colors">
            GanttSmart
          </Link>
          <Link to="/" className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[760px] mx-auto px-6 py-16">
        <p className="text-xs font-medium text-accent uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary mb-3">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-2">
          Effective date: <span className="text-text-secondary">April 16, 2026</span>
        </p>
        <p className="text-sm text-text-muted mb-10">
          Questions? Contact us at{' '}
          <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a>
        </p>

        <div className="border-t border-border-primary mb-10" />

        <Section title="1. Who We Are">
          <p>
            GanttSmart is an open-source Gantt chart visualization tool for{' '}
            <ExternalLink href="https://linear.app">Linear</ExternalLink> workspaces. It is developed and operated
            by <ExternalLink href="https://sideq.io">sideq.io</ExternalLink>, an unincorporated software project
            based in Lebanon.
          </p>
          <p className="mt-3">
            For the purposes of applicable data protection law — including the EU General Data Protection
            Regulation (GDPR) — sideq.io acts as the <strong className="text-text-secondary">data controller</strong> for personal
            data processed through the hosted service at ganttsmart.com.
          </p>
          <p className="mt-3">
            To contact us about privacy matters, please email{' '}
            <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a>.
          </p>
        </Section>

        <Section title="2. Scope of This Policy">
          <p>
            This Privacy Policy applies exclusively to the hosted version of GanttSmart at{' '}
            <span className="text-text-secondary">ganttsmart.com</span>. It describes how we collect, use, store,
            and protect your personal data when you use our service.
          </p>
          <p className="mt-3">
            If you self-host GanttSmart using the publicly available source code, you operate as an independent
            data controller and are solely responsible for your own privacy and data protection practices.
            This policy does not apply to self-hosted deployments.
          </p>
        </Section>

        <Section title="3. What Data We Collect and Why">
          <p>We collect only the data that is strictly necessary to provide the service. Below is a complete account of what we collect, the purpose, and the legal basis under GDPR.</p>

          <div className="mt-5 space-y-5">
            <DataCard
              title="Account & Authentication Data"
              data="Email address; Google profile information (name, avatar) if you sign in with Google OAuth."
              purpose="To create and manage your account and authenticate you across sessions."
              basis="Contract — processing is necessary to provide the service you requested (GDPR Art. 6(1)(b))."
            />
            <DataCard
              title="Linear OAuth Access Token"
              data="An OAuth 2.0 access token issued by Linear after you authorize GanttSmart."
              purpose="To read your Linear workspace data and write changes (e.g., rescheduled issues, status updates) back to Linear on your behalf."
              basis="Contract — the token is the mechanism by which the service is delivered (GDPR Art. 6(1)(b))."
            />
            <DataCard
              title="Linear Workspace Data"
              data="Issues, assignees, statuses, priorities, dates, and project metadata fetched from the Linear GraphQL API."
              purpose="To display your Gantt chart. This data is fetched on-demand and is not stored on our servers, except in cached share link snapshots (see Section 5)."
              basis="Contract (GDPR Art. 6(1)(b))."
            />
            <DataCard
              title="Share Link Configuration"
              data="Share link settings, access type (public or password-protected), a cryptographic hash of any password you set, and a cached snapshot of the Gantt data you chose to share."
              purpose="To serve your shared roadmap to external viewers. The snapshot enables the shared view to load without requiring Linear credentials from the viewer."
              basis="Legitimate interests — you explicitly initiated the share action (GDPR Art. 6(1)(f))."
            />
            <DataCard
              title="Browser Storage (localStorage / sessionStorage)"
              data="Theme preference (dark/light/system), last selected Linear project, onboarding completion state, and your authentication session token."
              purpose="To preserve your preferences across page loads and to maintain your login session. These are stored in your browser only — not on our servers."
              basis="Legitimate interests — strictly necessary for the application to function (GDPR Art. 6(1)(f))."
            />
          </div>

          <p className="mt-5 p-4 rounded-lg border border-border-primary text-xs text-text-muted leading-relaxed">
            <strong className="text-text-secondary">No tracking or profiling.</strong> We do not use advertising cookies, behavioral tracking, analytics platforms, or third-party data brokers. We do not build profiles on users or sell personal data.
          </p>
        </Section>

        <Section title="4. Cookies and Browser Storage">
          <p>
            GanttSmart does not use traditional HTTP cookies for tracking or advertising. The application uses
            browser <strong className="text-text-secondary">localStorage</strong> and{' '}
            <strong className="text-text-secondary">sessionStorage</strong> exclusively for the following strictly
            necessary purposes:
          </p>
          <ul className="mt-3 space-y-2 list-none">
            <Li><strong className="text-text-secondary">Authentication session</strong> — your login session token, stored in sessionStorage and cleared when you close the browser tab.</Li>
            <Li><strong className="text-text-secondary">Theme preference</strong> — your chosen colour theme (dark, light, or system), stored in localStorage.</Li>
            <Li><strong className="text-text-secondary">Project selection</strong> — the last Linear project you viewed, stored in localStorage so the app reopens where you left off.</Li>
            <Li><strong className="text-text-secondary">Onboarding state</strong> — whether you have completed the first-time setup, stored in localStorage.</Li>
          </ul>
          <p className="mt-4">
            You can clear this data at any time through your browser's developer tools or by clearing site data
            for ganttsmart.com. Clearing localStorage will reset your preferences; clearing sessionStorage will
            log you out.
          </p>

          <p className="mt-4 font-medium text-text-secondary">Google Fonts</p>
          <p className="mt-2">
            GanttSmart loads the Inter typeface from{' '}
            <ExternalLink href="https://fonts.googleapis.com">fonts.googleapis.com</ExternalLink>. This causes
            your browser to make a direct request to Google's servers, which may log your IP address and
            user-agent string. We do not control this logging. If this is a concern, you can use a browser
            extension to block Google Fonts requests — the application will fall back to your system font.
          </p>
        </Section>

        <Section title="5. Shareable Roadmap Links">
          <p>
            When you create a shareable roadmap link, GanttSmart stores a snapshot of the selected Gantt data
            (issues, dates, assignees, statuses) in our database to serve the shared view to external viewers
            without requiring a Linear account.
          </p>
          <ul className="mt-3 space-y-2 list-none">
            <Li>Snapshots are scoped to the issues and projects you selected at the time of sharing.</Li>
            <Li>Password-protected links store only a cryptographic hash of the password — the plaintext password is never retained.</Li>
            <Li>You can delete any share link at any time from the Share dialog in the application. Deletion permanently removes the associated snapshot from our servers.</Li>
            <Li>Share links do not expose your Linear credentials or any data beyond what you explicitly chose to share.</Li>
          </ul>
        </Section>

        <Section title="6. How We Use Your Data">
          <p>We use the data described above solely to:</p>
          <ul className="mt-3 space-y-2 list-none">
            <Li>Authenticate you and maintain a secure session.</Li>
            <Li>Fetch your Linear workspace data and render it as a Gantt chart.</Li>
            <Li>Write changes (date adjustments, status updates) back to Linear using your authorized credentials.</Li>
            <Li>Serve shared roadmap views to the viewers you authorise.</Li>
          </ul>
          <p className="mt-3">
            We do not use your data for marketing, advertising, analytics, machine learning training, or
            any purpose beyond providing the service you signed up for.
          </p>
        </Section>

        <Section title="7. Data Storage and Security">
          <p>
            All server-side user data is stored in a{' '}
            <ExternalLink href="https://supabase.com">Supabase</ExternalLink>-hosted PostgreSQL database located
            in the <strong className="text-text-secondary">European Union</strong>. The database is protected by
            Row-Level Security (RLS) policies, ensuring each user can only access their own data.
          </p>
          <p className="mt-3">
            Linear OAuth tokens are stored server-side only and are never transmitted to or accessible by the
            browser after the initial OAuth exchange. All data in transit is protected by TLS (HTTPS).
          </p>
          <p className="mt-3">
            We take reasonable technical and organisational measures to protect your data from unauthorised
            access, disclosure, or loss. However, no internet transmission is 100% secure. In the event of
            a data breach affecting your personal data, we will notify affected users without undue delay and,
            where required, notify the relevant supervisory authority within 72 hours.
          </p>
        </Section>

        <Section title="8. Third-Party Services">
          <p>We rely on the following third-party services to operate GanttSmart. Each processes data under their own privacy policies.</p>
          <div className="mt-4 space-y-4">
            <ThirdParty
              name="Supabase"
              role="Authentication, database, and serverless functions (Edge Functions). Hosted in the EU."
              link="https://supabase.com/privacy"
            />
            <ThirdParty
              name="Linear"
              role="Your workspace data is read from and written to Linear's GraphQL API via your authorised OAuth token."
              link="https://linear.app/privacy"
            />
            <ThirdParty
              name="Netlify"
              role="Static frontend hosting. Netlify's infrastructure may log standard web server access data (IP, user-agent) as part of normal hosting operations."
              link="https://www.netlify.com/privacy/"
            />
            <ThirdParty
              name="Google Fonts"
              role="Serves the Inter typeface. Your browser connects directly to Google's servers to load font files, which may log your IP address."
              link="https://policies.google.com/privacy"
            />
          </div>
        </Section>

        <Section title="9. International Data Transfers">
          <p>
            GanttSmart is operated from Lebanon. By using the service, you acknowledge that your data may be
            processed in Lebanon, which is not currently recognised by the European Commission as providing an
            adequate level of data protection equivalent to the EU/EEA.
          </p>
          <p className="mt-3">
            Your data is stored on Supabase infrastructure within the EU. Processing by sideq.io (e.g., when
            handling deletion requests) occurs in Lebanon. We apply the same data protection standards to all
            processing regardless of location, consistent with our obligations under GDPR.
          </p>
        </Section>

        <Section title="10. Your Rights (GDPR)">
          <p>If you are located in the EU/EEA, you have the following rights under the General Data Protection Regulation:</p>
          <ul className="mt-3 space-y-2 list-none">
            <Li><strong className="text-text-secondary">Right of access (Art. 15)</strong> — request a copy of the personal data we hold about you.</Li>
            <Li><strong className="text-text-secondary">Right to rectification (Art. 16)</strong> — request correction of inaccurate or incomplete data.</Li>
            <Li><strong className="text-text-secondary">Right to erasure (Art. 17)</strong> — request deletion of your personal data ("right to be forgotten").</Li>
            <Li><strong className="text-text-secondary">Right to restriction (Art. 18)</strong> — request that we limit how we process your data in certain circumstances.</Li>
            <Li><strong className="text-text-secondary">Right to data portability (Art. 20)</strong> — request your data in a structured, machine-readable format.</Li>
            <Li><strong className="text-text-secondary">Right to object (Art. 21)</strong> — object to processing based on legitimate interests.</Li>
            <Li><strong className="text-text-secondary">Right to lodge a complaint</strong> — you may file a complaint with your local data protection authority (DPA) if you believe we have not handled your data lawfully.</Li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, please email{' '}
            <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a> with a clear
            description of your request. We will respond within <strong className="text-text-secondary">30 days</strong>.
          </p>
        </Section>

        <Section title="11. Data Retention and Deletion">
          <p>We retain your personal data for as long as your account is active and the service is in use.</p>
          <ul className="mt-4 space-y-3 list-none">
            <Li>
              <strong className="text-text-secondary">To revoke Linear access:</strong> Disconnect your Linear account from within the app at any time. This immediately invalidates and removes your stored OAuth token and associated Linear settings from our database.
            </Li>
            <Li>
              <strong className="text-text-secondary">To request full account deletion:</strong> Email{' '}
              <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a> with the
              subject line "Account Deletion Request" and the email address associated with your account. We will permanently
              delete your account and all associated data within <strong className="text-text-secondary">30 days</strong> of
              receiving your request and send you a confirmation.
            </Li>
            <Li>
              <strong className="text-text-secondary">To delete share links:</strong> Delete individual share links directly from the Share dialog in the app. This immediately removes the link and its cached data snapshot.
            </Li>
          </ul>
          <p className="mt-4">
            Browser-stored data (localStorage / sessionStorage) is stored on your device and can be cleared
            at any time through your browser settings.
          </p>
        </Section>

        <Section title="12. Children's Privacy">
          <p>
            GanttSmart is not intended for use by individuals under the age of 18. We do not knowingly collect
            personal data from persons under 18. If we become aware that we have inadvertently collected data
            from a person under 18, we will promptly delete it. Please contact us at{' '}
            <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a> if you
            have concerns.
          </p>
        </Section>

        <Section title="13. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology,
            legal requirements, or other factors. When we make material changes, we will update the effective
            date at the top of this page and publish a notice on the{' '}
            <ExternalLink href="https://github.com/sideq-io/ganttsmart">GanttSmart GitHub repository</ExternalLink>.
          </p>
          <p className="mt-3">
            Your continued use of ganttsmart.com after changes are posted constitutes your acceptance of the
            revised policy. If you do not agree with the changes, please discontinue use of the service and
            contact us to delete your account.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>For any privacy-related questions, requests, or concerns:</p>
          <div className="mt-4 p-4 rounded-lg border border-border-primary space-y-2 text-sm">
            <p><span className="text-text-secondary">Email:</span> <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a></p>
            <p><span className="text-text-secondary">GitHub:</span> <ExternalLink href="https://github.com/sideq-io/ganttsmart">github.com/sideq-io/ganttsmart</ExternalLink></p>
            <p><span className="text-text-secondary">Website:</span> <ExternalLink href="https://sideq.io">sideq.io</ExternalLink></p>
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-primary px-6 py-6 mt-8">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="text-xs text-text-muted">
            © 2025–2026{' '}
            <a href="https://sideq.io" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary transition-colors">
              sideq.io
            </a>
            . All rights reserved.
          </span>
          <div className="flex items-center gap-5">
            <a href="https://github.com/sideq-io/ganttsmart" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-text-secondary transition-colors">GitHub</a>
            <Link to="/privacy-policy" className="text-xs text-text-secondary">Privacy</Link>
            <Link to="/terms-of-service" className="text-xs text-text-muted hover:text-text-secondary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-text-primary mb-3 pb-2 border-b border-border-primary">{title}</h2>
      <div className="text-sm text-text-muted leading-relaxed">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="text-accent mt-[3px] shrink-0 text-xs">▸</span>
      <span>{children}</span>
    </li>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  );
}

function DataCard({ title, data, purpose, basis }: { title: string; data: string; purpose: string; basis: string }) {
  return (
    <div className="rounded-lg border border-border-primary p-4 space-y-2">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{title}</p>
      <div className="grid gap-1.5 text-xs">
        <p><span className="text-text-secondary font-medium">Data collected:</span> {data}</p>
        <p><span className="text-text-secondary font-medium">Purpose:</span> {purpose}</p>
        <p><span className="text-text-secondary font-medium">Legal basis:</span> {basis}</p>
      </div>
    </div>
  );
}

function ThirdParty({ name, role, link }: { name: string; role: string; link: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <div className="shrink-0 w-24 font-medium text-text-secondary pt-0.5">{name}</div>
      <div className="flex-1 text-text-muted leading-relaxed">
        {role}{' '}
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline whitespace-nowrap">
          Privacy policy ↗
        </a>
      </div>
    </div>
  );
}
