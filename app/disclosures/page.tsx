import { site } from "@/lib/site";

export const metadata = {
  title: "Disclosures",
  description:
    "Disclosures, disclaimers, and terms of use governing this site and its content.",
};

export default function DisclosuresPage() {
  return (
    <article className="page-narrow">
      <p className="eyebrow">Disclosures</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Disclosures and terms of use
      </h1>
      <p className="mt-4 font-sans text-sm text-muted">
        Last updated April 2026.
      </p>

      <div className="prose prose-neutral mt-10 max-w-none">
        <p>
          By accessing this site, subscribing to any newsletter or feed
          published from it, downloading any attachment made available on it,
          or otherwise relying on any content found on it, you agree to the
          terms set out below. If you do not agree, do not use the site.
        </p>

        <h2>1. Nature of the content</h2>
        <p>
          The materials published on this site — including all written posts,
          spreadsheets, attachments, emails, and feeds — are bona fide
          publications of general and regular circulation, made available
          impersonally to the public. Nothing on this site is tailored to your
          individual financial situation, investment objectives, risk
          tolerance, tax position, or any other particular circumstance.
        </p>
        <p>
          The author publishes in reliance on the publisher&apos;s exclusion
          from the definition of &ldquo;investment adviser&rdquo; under
          Section 202(a)(11)(D) of the Investment Advisers Act of 1940 and the
          standard articulated by the United States Supreme Court in{" "}
          <em>Lowe v. SEC</em>, 472 U.S. 181 (1985). The author is not a
          registered investment adviser, broker-dealer, futures commission
          merchant, commodity pool operator, or commodity trading advisor in
          any jurisdiction.
        </p>

        <h2>2. Not investment, legal, tax, or accounting advice</h2>
        <p>
          Nothing published on this site constitutes, or should be construed
          as, investment advice, legal advice, tax advice, accounting advice,
          or a recommendation to buy, sell, hold, or trade any security or
          other financial instrument. If you require advice in any of these
          areas, you should consult a licensed professional able to take
          responsibility for your specific situation.
        </p>

        <h2>3. No offer or solicitation</h2>
        <p>
          Nothing on this site constitutes an offer to sell, or a solicitation
          of an offer to buy, any security, financial instrument, or service
          in any jurisdiction. All content is provided for informational and
          discussion purposes only.
        </p>

        <h2>4. Positions and potential conflicts of interest</h2>
        <p>
          The author may, at any time, hold long or short positions — directly
          or indirectly, including through derivatives — in any of the
          securities, instruments, or issuers discussed on this site. Where the
          author holds a position in a security at the time of publication, the
          author will use commercially reasonable efforts to disclose that fact
          in or near the relevant post. The author is under no obligation to
          disclose subsequent changes to any position, and any disclosed
          position may have been closed or reversed at any time after
          publication without further notice.
        </p>
        <p>
          The author may also have business, professional, or personal
          relationships with issuers, their officers, directors, employees, or
          affiliates that may constitute potential conflicts of interest.
        </p>

        <h2>5. No compensation for content</h2>
        <p>
          The author does not accept payment, securities, or any other
          consideration in exchange for publishing favorable or unfavorable
          opinions about any security, issuer, or third party. This site does
          not host advertising and is not sponsored. Should this ever change,
          all material terms of any such arrangement will be disclosed in
          compliance with Section 17(b) of the Securities Act of 1933.
        </p>

        <h2>6. Information sources and accuracy</h2>
        <p>
          Information on this site is drawn from sources the author believes
          to be reliable — typically including public filings, regulatory
          disclosures, news media, and paid data services — together with the
          author&apos;s own analysis. The author makes no representation or
          warranty, express or implied, as to the accuracy, completeness,
          timeliness, or fitness for any particular purpose of any information
          presented. All content is provided{" "}
          <strong>&ldquo;AS IS&rdquo;</strong> and{" "}
          <strong>&ldquo;AS AVAILABLE&rdquo;</strong> without warranty of any
          kind, whether express, implied, statutory, or otherwise.
        </p>

        <h2>7. Forward-looking statements</h2>
        <p>
          Posts may contain forward-looking statements — including projections,
          forecasts, opinions about future market conditions, and estimates of
          intrinsic value or future cash flows. Forward-looking statements are
          inherently speculative, depend on assumptions that may prove
          inaccurate, and should not be relied upon. Actual results may differ
          materially from any forward-looking statement.
        </p>

        <h2>8. Past performance</h2>
        <p>
          Past performance — whether of a security, market, strategy, model,
          investor, or commentator — is not indicative of future results. Any
          discussion of past performance should not be construed as a
          prediction of future performance.
        </p>

        <h2>9. No fiduciary, advisory, or client relationship</h2>
        <p>
          Reading this site, subscribing to any newsletter or feed, downloading
          any attachment, or corresponding with the author by email or any
          other means <strong>does not create</strong> an investment-advisory,
          brokerage, fiduciary, agency, or client relationship of any kind.
          The author owes no duty of care, loyalty, suitability, or best
          execution to any reader.
        </p>

        <h2>10. Your responsibility</h2>
        <p>
          You are solely responsible for any decisions you make in connection
          with, or in reliance on, anything published on this site. You should
          perform your own due diligence — including reading primary-source
          materials, building your own models, and consulting professionals who
          know your situation — before acting on any view expressed here.
        </p>

        <h2>11. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law, in no event shall
          the author be liable to you or to any third party for any direct,
          indirect, incidental, special, consequential, exemplary, or punitive
          damages — including, without limitation, loss of profits, loss of
          revenue, loss of use, loss of data, or loss of goodwill — arising out
          of or in connection with your access to or use of this site, any
          content published on it, any attachment downloaded from it, or any
          reliance placed on any view expressed on it, regardless of the legal
          theory on which such liability is based and regardless of whether the
          author has been advised of the possibility of such damages.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless the author from
          and against any claims, liabilities, damages, losses, costs, or
          expenses (including reasonable attorneys&apos; fees) arising out of
          or related to your use of this site or your breach of these
          disclosures.
        </p>

        <h2>13. Jurisdiction and intended audience</h2>
        <p>
          The content on this site is intended for general informational
          purposes for an audience located in jurisdictions where its
          publication is lawful. It is not directed at, and the content should
          not be relied upon by, any person located in a jurisdiction in which
          such publication, distribution, or reliance would be contrary to
          local law or regulation. Nothing on this site is intended to be, and
          should not be construed as, an offer of securities to any U.S.
          person in violation of the Securities Act of 1933 or to any non-U.S.
          person in violation of any applicable non-U.S. law.
        </p>

        <h2>14. Email, attachments, and privacy</h2>
        <p>
          If you subscribe with your email address, that address is stored
          with the author&apos;s email service provider and used only to
          deliver new posts. The author does not sell, rent, or otherwise
          share subscriber information with third parties for marketing
          purposes. You may unsubscribe from any email by following the
          unsubscribe link contained in that email.
        </p>
        <p>
          Spreadsheet attachments and other downloadable materials are provided
          for informational purposes only. They reflect the author&apos;s own
          assumptions and methodologies as of the date of publication, may
          contain errors, and may become out of date without notice. You
          should not rely on any model attached to any post without
          independent verification.
        </p>

        <h2>15. Modifications</h2>
        <p>
          The author may modify these disclosures at any time by posting a
          revised version on this page. The &ldquo;Last updated&rdquo; date
          above will reflect the most recent revision. Your continued use of
          the site following any such modification constitutes your acceptance
          of the modified disclosures.
        </p>

        <h2>16. Severability</h2>
        <p>
          If any provision of these disclosures is found to be unenforceable
          or invalid by a court of competent jurisdiction, that provision
          shall be limited or eliminated to the minimum extent necessary so
          that these disclosures shall otherwise remain in full force and
          effect.
        </p>

        <h2>17. Governing law</h2>
        <p>
          These disclosures, and any dispute or claim arising out of or in
          connection with them, the site, or any content published on it,
          shall be governed by and construed in accordance with the federal
          laws of the United States and the laws of the State of{" "}
          <strong>[State of residence]</strong>, without regard to its
          conflict-of-laws principles. You and the author submit to the
          exclusive jurisdiction of the federal and state courts located in{" "}
          <strong>[County, State]</strong> for the resolution of any such
          dispute.
        </p>

        <h2>18. Contact</h2>
        <p>
          Questions, corrections, or concerns regarding these disclosures may
          be directed to{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </div>
    </article>
  );
}
