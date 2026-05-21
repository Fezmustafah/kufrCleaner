// src/pages/posts/[...id].md.ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const posts = await getCollection('posts');
    const isDev = import.meta.env.DEV;
    const visiblePosts = posts.filter((post) =>
      isDev ? true : !post.data.draft
    );
    return visiblePosts.map((post) => ({
      params: { id: post.id },
      props: { body: post.body ?? '' },
    }));
  } catch {
    return [];
  }
};

export const GET: APIRoute = ({ props }) => {
  return new Response(props.body as string, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
