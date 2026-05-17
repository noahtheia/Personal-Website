import { notFound } from "next/navigation";
import { loadPostAction } from "../../actions";
import { AdminPostEditor } from "../../AdminPostEditor";

export const dynamic = "force-dynamic";

export default async function AdminEditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPostAction(slug);
  if (!post) notFound();
  return <AdminPostEditor initial={post} />;
}
