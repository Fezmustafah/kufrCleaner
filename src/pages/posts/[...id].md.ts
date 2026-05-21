// src/pages/posts/[...id].md.ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts');
  return posts.map((post) => ({
    params: { id: post.id },
    props: { body: post.body ?? '' },
  }));
};

export const GET: APIRoute = ({ props }) => {
  return new Response(props.body as string, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
