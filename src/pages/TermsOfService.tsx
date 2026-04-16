import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

export default function TermsOfService() {
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
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary mb-3">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-2">
          Effective date: <span className="text-text-secondary">April 16, 2026</span>
        </p>
        <p className="text-sm text-text-muted mb-10">
          Questions? Contact us at{' '}
          <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a>
        </p>

        <div className="border-t border-border-primary mb-10" />

        <Section title="1. Agreement to Terms">
          <p>
            These Terms of Service ("Terms") constitute a legally binding agreement between you and sideq.io
            ("we", "us", or "our") governing your access to and use of GanttSmart at{' '}
            <span className="text-text-secondary">ganttsmart.com</span> (the "Service").
          </p>
          <p className="mt-3">
            By accessing or using the Service, you confirm that you have read, understood, and agree to be
            bound by these Terms and our{' '}
            <Link to="/privacy-policy" className="text-accent hover:underline">Privacy Policy</Link>.
            If you do not agree, you must not use the Service.
          </p>
          <p className="mt-3">
            These Terms apply only to the hosted version at ganttsmart.com. Use of the open-source codebase
            is governed exclusively by the{' '}
            <ExternalLink href="https://github.com/sideq-io/ganttsmart/blob/main/LICENSE">AGPL-3.0 licence</ExternalLink>.
          </p>
        </Section>

        <Section title="2. About GanttSmart">
          <p>
            GanttSmart is an interactive Gantt chart visualisation and planning tool for{' '}
            <ExternalLink href="https://linear.app">Linear</ExternalLink> workspaces. It is developed by
            sideq.io — an unincorporated software project operated from Lebanon — and is made available as
            open-source software under the AGPL-3.0 licence, with a free hosted version at ganttsmart.com.
          </p>
          <p className="mt-3">
            GanttSmart is not affiliated with, endorsed by, or an official product of Linear Orbit, Inc.
            "Linear" is a trademark of Linear Orbit, Inc.
          </p>
        </Section>

        <Section title="3. Eligibility">
          <p>To use the Service you must:</p>
          <ul className="mt-3 space-y-2 list-none">
            <Li>Be at least 18 years of age.</Li>
            <Li>Have a valid, active Linear account in good standing.</Li>
            <Li>
              Have the legal authority to grant GanttSmart OAuth access to your Linear workspace. If you are
              acting on behalf of an organisation, you represent and warrant that you have the authority to bind
              that organisation to these Terms.
            </Li>
            <Li>Not be barred from using the Service under any applicable law.</Li>
          </ul>
        </Section>

        <Section title="4. Your Account">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all
            activity that occurs under your account. You agree to notify us immediately at{' '}
            <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a> if you
            suspect any unauthorised access to your account.
          </p>
          <p className="mt-3">
            We reserve the right to disable accounts that are in violation of these Terms.
          </p>
        </Section>

        <Section title="5. Acceptable Use">
          <p className="font-medium text-text-secondary">Permitted use</p>
          <p className="mt-2">Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable licence to use the Service for:</p>
          <ul className="mt-2 space-y-2 list-none">
            <Li>Personal use.</Li>
            <Li>Educational or research use.</Li>
            <Li>Internal, non-commercial use within your organisation.</Li>
          </ul>

          <p className="mt-5 font-medium text-text-secondary">Prohibited use</p>
          <p className="mt-2">You may not:</p>
          <ul className="mt-2 space-y-2 list-none">
            <Li>Use the Service to build a competing commercial product or managed service without a commercial licence from sideq.io.</Li>
            <Li>Resell, sublicence, or provide access to the hosted Service to third parties as a paid offering.</Li>
            <Li>Reverse-engineer, decompile, or disassemble any part of the hosted Service (beyond what is permitted by the AGPL-3.0 licence for the open-source portions).</Li>
            <Li>Attempt to gain unauthorised access to our systems, databases, or other users' accounts.</Li>
            <Li>Abuse, overload, or deliberately degrade the performance of the Linear API or GanttSmart's infrastructure.</Li>
            <Li>Use automated scripts or bots to interact with the Service beyond normal usage.</Li>
            <Li>Use the Service in a manner that violates any applicable law or regulation, including data protection laws.</Li>
            <Li>Upload or transmit any content that is unlawful, harmful, or infringes the rights of a third party.</Li>
          </ul>
        </Section>

        <Section title="6. Linear Integration">
          <p>
            GanttSmart connects to your Linear workspace as an authorised OAuth 2.0 client application, using
            only the permissions you explicitly grant during the OAuth authorisation flow.
          </p>
          <p className="mt-3">
            Actions you initiate within GanttSmart — such as rescheduling issues by drag-and-drop or cycling
            through workflow statuses — result in direct write operations to your Linear workspace via the
            Linear API. <strong className="text-text-secondary">You are solely responsible for reviewing and
            approving any changes made to your Linear data through the Service.</strong> We recommend using
            the Undo function (Ctrl+Z / Cmd+Z) if you make an unintended change.
          </p>
          <p className="mt-3">
            Your continued use of Linear is governed by{' '}
            <ExternalLink href="https://linear.app/terms">Linear's Terms of Service</ExternalLink>.
            GanttSmart is not responsible for any changes to Linear's API, feature availability, or pricing.
          </p>
        </Section>

        <Section title="7. Shareable Roadmap Links">
          <p>
            The Service allows you to create shareable links that provide a read-only view of selected Gantt
            data to external parties. By creating a share link, you acknowledge that:
          </p>
          <ul className="mt-3 space-y-2 list-none">
            <Li>The data included in the shared view will be accessible to anyone with the link (or, for password-protected links, anyone with the link and password).</Li>
            <Li>You are responsible for ensuring you have the right to share the included data with the intended recipients.</Li>
            <Li>You can revoke access at any time by deleting the link from within the application.</Li>
          </ul>
        </Section>

        <Section title="8. Open Source and Licensing">
          <p>
            GanttSmart is open-source software licensed under the{' '}
            <ExternalLink href="https://www.gnu.org/licenses/agpl-3.0.html">GNU Affero General Public Licence v3.0 (AGPL-3.0)</ExternalLink>.
            Copyright © 2025–2026 sideq.io. All rights reserved.
          </p>

          <div className="mt-4 rounded-lg border border-border-primary overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary bg-bg-hover">
                  <th className="text-left py-2.5 px-4 text-text-secondary font-medium">Use case</th>
                  <th className="text-left py-2.5 px-4 text-text-secondary font-medium">Allowed?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {[
                  ['Personal / educational / research use', 'Free — AGPL-3.0 applies'],
                  ['Self-hosted deployment (non-commercial)', 'Free — attribution required; source must remain open under AGPL-3.0'],
                  ['Fork and modify (non-commercial)', 'Free — derivative works must also be released under AGPL-3.0'],
                  ['Commercial use, SaaS offering, or rebranding', 'Requires a separate commercial licence from sideq.io'],
                ].map(([useCase, allowed]) => (
                  <tr key={useCase} className="text-text-muted">
                    <td className="py-2.5 px-4">{useCase}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{allowed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4">
            To enquire about a commercial licence, please contact us at{' '}
            <a href="mailto:info@sideq.io" className="text-accent hover:underline">info@sideq.io</a>.
          </p>
        </Section>

        <Section title="9. Intellectual Property">
          <ul className="space-y-3 list-none">
            <Li>
              <strong className="text-text-secondary">GanttSmart source code</strong> — licensed under AGPL-3.0. Copyright © 2025–2026 sideq.io.
            </Li>
            <Li>
              <strong className="text-text-secondary">GanttSmart name and branding</strong> — the "GanttSmart" name, logo, and visual identity are proprietary to sideq.io. You may not use them without prior written consent.
            </Li>
            <Li>
              <strong className="text-text-secondary">Your Linear data</strong> — all data originating from your Linear workspace remains your property (or your organisation's). GanttSmart claims no ownership over your data.
            </Li>
          </ul>
        </Section>

        <Section title="10. Privacy">
          <p>
            Our collection and use of personal data in connection with the Service is described in our{' '}
            <Link to="/privacy-policy" className="text-accent hover:underline">Privacy Policy</Link>, which is
            incorporated into these Terms by reference. By using the Service, you consent to the data practices
            described therein.
          </p>
        </Section>

        <Section title="11. Disclaimer of Warranties">
          <p className="uppercase text-xs tracking-wide font-medium text-text-secondary mb-3">Please read carefully</p>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            TITLE, OR NON-INFRINGEMENT.
          </p>
          <p className="mt-3">
            We do not warrant that: (a) the Service will be uninterrupted, timely, secure, or error-free;
            (b) any errors or defects will be corrected; (c) the Service is free of harmful components; or
            (d) data displayed in the application will be accurate, complete, or up-to-date at all times
            (data is sourced in real time from the Linear API and reflects the state of your workspace).
          </p>
        </Section>

        <Section title="12. Limitation of Liability">
          <p className="uppercase text-xs tracking-wide font-medium text-text-secondary mb-3">Please read carefully</p>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SIDEQ.IO AND ITS AUTHORS SHALL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR IN
            CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE SERVICE — INCLUDING BUT NOT LIMITED TO LOSS
            OF DATA, LOSS OF REVENUE, LOSS OF PROFITS, OR BUSINESS INTERRUPTION — EVEN IF ADVISED OF THE
            POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p className="mt-3">
            BECAUSE THE HOSTED SERVICE IS PROVIDED FREE OF CHARGE, SIDEQ.IO'S TOTAL AGGREGATE LIABILITY TO
            YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNTS
            YOU HAVE PAID TO SIDEQ.IO IN THE 12 MONTHS PRECEDING THE CLAIM; OR (B) ZERO DOLLARS (USD $0).
          </p>
          <p className="mt-3 text-xs">
            Some jurisdictions do not permit the exclusion or limitation of certain implied warranties or
            liabilities. In such jurisdictions, the limitations above apply only to the extent permitted by law.
          </p>
        </Section>

        <Section title="13. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless sideq.io and its authors from and against any
            claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out
            of or in connection with: (a) your violation of these Terms; (b) your use of the Service; (c) any
            data you submit to or share through the Service; or (d) your violation of any third party's rights,
            including Linear's terms of service.
          </p>
        </Section>

        <Section title="14. Termination">
          <p>
            You may stop using the Service at any time. To close your account and delete your data, please
            refer to the instructions in our{' '}
            <Link to="/privacy-policy" className="text-accent hover:underline">Privacy Policy</Link>.
          </p>
          <p className="mt-3">
            We reserve the right to suspend or terminate your access to the Service at any time, with or
            without notice, if we reasonably believe you have violated these Terms or if we discontinue
            the Service. Upon termination, your stored data will be deleted in accordance with our Privacy Policy.
          </p>
        </Section>

        <Section title="15. Changes to These Terms">
          <p>
            We may revise these Terms from time to time. When we make material changes, we will update the
            effective date at the top of this page and publish a notice on the{' '}
            <ExternalLink href="https://github.com/sideq-io/ganttsmart">GanttSmart GitHub repository</ExternalLink>.
          </p>
          <p className="mt-3">
            Your continued use of the Service after revised Terms are posted constitutes your acceptance of
            those changes. If you do not accept the revised Terms, please discontinue use of the Service.
          </p>
          <p className="mt-3">
            If a paid tier is introduced in the future, a separate billing agreement will govern payment terms
            and will be presented to you before any charge is made.
          </p>
        </Section>

        <Section title="16. Governing Law and Dispute Resolution">
          <p>
            These Terms are governed by and construed in accordance with the laws of Lebanon, without regard
            to its conflict of law provisions.
          </p>
          <p className="mt-3">
            In the event of any dispute arising out of or in connection with these Terms or the Service, the
            parties agree to first attempt to resolve the dispute through good-faith negotiation. If resolution
            cannot be reached within 30 days, either party may seek mediation or recourse through the courts of
            competent jurisdiction in Lebanon.
          </p>
          <p className="mt-3">
            If you are a consumer located in the EU/EEA, you may also be entitled to submit your dispute to
            an alternative dispute resolution (ADR) body or your local courts under applicable consumer
            protection law, which these Terms do not limit.
          </p>
        </Section>

        <Section title="17. Miscellaneous">
          <ul className="space-y-2 list-none">
            <Li><strong className="text-text-secondary">Entire agreement.</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and sideq.io regarding the Service and supersede all prior agreements.</Li>
            <Li><strong className="text-text-secondary">Severability.</strong> If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</Li>
            <Li><strong className="text-text-secondary">Waiver.</strong> Our failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision.</Li>
            <Li><strong className="text-text-secondary">No agency.</strong> Nothing in these Terms creates a partnership, joint venture, employment, or agency relationship between you and sideq.io.</Li>
          </ul>
        </Section>

        <Section title="18. Contact">
          <p>For questions, concerns, or legal notices regarding these Terms:</p>
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
            <Link to="/privacy-policy" className="text-xs text-text-muted hover:text-text-secondary transition-colors">Privacy</Link>
            <Link to="/terms-of-service" className="text-xs text-text-secondary">Terms</Link>
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
