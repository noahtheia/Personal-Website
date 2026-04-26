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
        <p>
          Reach out: <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
      </div>
    </article>
  );
}
