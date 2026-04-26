import { site } from "@/lib/site";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article>
      <p className="eyebrow">About</p>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {site.author}
      </h1>

      <div className="prose prose-neutral mt-8 max-w-none">
        <p>
          Long-form investment write-ups and macro essays for sophisticated investors.
          I write about ideas I&apos;m actively researching — usually single names or
          situations, occasionally the macro context I think they live inside.
        </p>
        <p>
          Most posts come with the spreadsheet I built while working through the idea.
          Treat it as the input to your own thinking, not the answer.
        </p>
      </div>

      <section className="mt-10 border-t border-rule pt-8">
        <p className="eyebrow">Elsewhere</p>
        <ul className="mt-4 space-y-2 font-sans text-[0.95rem]">
          <li>
            <a
              href={`mailto:${site.email}`}
              className="!text-fg no-underline underline-offset-4 hover:!text-accent hover:underline"
            >
              Email
            </a>
            <span className="ml-2 text-muted">{site.email}</span>
          </li>
          {site.socials.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="!text-fg no-underline underline-offset-4 hover:!text-accent hover:underline"
              >
                {s.label}
              </a>
              <span className="ml-2 text-muted">
                {s.href.replace(/^https?:\/\//, "")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
