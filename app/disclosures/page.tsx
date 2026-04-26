import { site } from "@/lib/site";

export const metadata = {
  title: "Disclosures",
  description:
    "Disclosures, disclaimers, and what you should know before reading anything else here.",
};

export default function DisclosuresPage() {
  return (
    <article>
      <p className="eyebrow">Disclosures</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        What you should know
      </h1>
      <p className="mt-4 font-sans text-base text-muted">
        Last updated April 2026.
      </p>

      <div className="prose prose-neutral mt-10 max-w-none">
        <h2>I&apos;m not a registered investment advisor</h2>
        <p>
          I write here in a personal capacity. Nothing on this site is
          investment advice, a recommendation to buy or sell any security, or
          a solicitation of any kind of business. I&apos;m not your advisor,
          broker, or fiduciary. If you want investment advice, hire someone who
          can take responsibility for your portfolio — that isn&apos;t me.
        </p>

        <h2>I may own what I write about</h2>
        <p>
          I sometimes hold positions in companies I discuss. When I write up an
          idea I currently hold — long or short — I&apos;ll say so at the top
          of the post. When I exit a position, I won&apos;t necessarily tell
          you. My positions can change at any time without notice.
        </p>
        <p>
          I mostly write about names I find interesting, which generally means
          names I&apos;ve already done work on. Assume I have skin in the game
          unless I tell you otherwise.
        </p>

        <h2>I might be wrong</h2>
        <p>
          Everything here is my opinion as of the date the post was written.
          Markets change. Theses break. I won&apos;t necessarily update old
          posts as my views evolve, so anything more than a few months old
          should be read as a snapshot, not as my current view. Past
          performance — mine, anyone else&apos;s, or an asset&apos;s — is not
          indicative of future results.
        </p>
        <p>
          I source numbers from public filings, data services, and my own
          spreadsheets. I do my best to be accurate, but I make mistakes. If
          you spot one, email me.
        </p>

        <h2>You&apos;re responsible for your own decisions</h2>
        <p>
          If you act on anything you read here, that&apos;s on you. I have no
          way to know your situation, your risk tolerance, or your tax
          circumstances. Do your own work. Read the filings. Build your own
          model. Talk to someone who actually knows your situation.
        </p>

        <h2>No client or fiduciary relationship</h2>
        <p>
          Reading this site, subscribing to the newsletter, or emailing me does
          not create a client, advisor, fiduciary, or any other relationship
          that would obligate me to act in your interest. I&apos;ll respond to
          thoughtful questions when I can, but those replies are conversation,
          not advice.
        </p>

        <h2>No sponsorship</h2>
        <p>
          This site is not sponsored. I don&apos;t take payment to write about
          specific companies, and there is no advertising. If that ever
          changes, I&apos;ll say so plainly.
        </p>

        <h2>Email and privacy</h2>
        <p>
          If you subscribe with your email, that address is stored with my
          email provider and used only to send you new posts. I don&apos;t
          share or sell it. You can unsubscribe from any email I send.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, corrections, pushback:{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </div>
    </article>
  );
}
