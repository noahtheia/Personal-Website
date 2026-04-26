export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="prose prose-neutral max-w-none prose-headings:font-sans">
      <h1>About</h1>
      <p>
        I&apos;m Noah. I write about investment ideas I&apos;m researching — usually
        single companies or situations, occasionally frameworks I&apos;m chewing on.
      </p>
      <p>
        Most posts come with the spreadsheet I built while thinking through the
        idea. Treat them as inputs to your own thinking, not advice.
      </p>
      <p>
        Reach out: <a href="mailto:hello@example.com">hello@example.com</a>
      </p>
    </div>
  );
}
