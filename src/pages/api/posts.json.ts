import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { shouldShowPost } from "@/utils/markdown";
import { cleanContent } from "@/utils/search";

export const GET: APIRoute = async () => {
  try {
    const posts = await getCollection("posts");
    const isDev = import.meta.env.DEV;
    const visiblePosts = posts.filter((post: any) => shouldShowPost(post, isDev));

    const data = visiblePosts.map((post: any) => {
      const cleaned = cleanContent(post.body || '');
      const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
      return {
        id: post.id,
        title: post.data.title,
        description: post.data.description,
        url: `${import.meta.env.BASE_URL}posts/${post.id}`,
        type: "post" as const,
        date: post.data.date,
        tags: post.data.tags || [],
        category: post.data.category || null,
        excerpt: cleaned.slice(0, 500),
        readingTime: Math.max(1, Math.ceil(wordCount / 200)),
      };
    });

    data.sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
