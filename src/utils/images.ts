// Strip Obsidian double bracket syntax from image paths
export function stripObsidianBrackets(imagePath: string): string {
  if (!imagePath) return imagePath;

  if (imagePath.startsWith("[[") && imagePath.endsWith("]]")) {
    return imagePath.slice(2, -2);
  }

  return imagePath;
}

// Optimize image path specifically for posts
export function optimizePostImagePath(
  imagePath: string,
  postSlug?: string,
  postId?: string
): string {
  if (!imagePath || typeof imagePath !== "string") {
    return "/posts/attachments/placeholder.jpg";
  }

  const cleanPath = stripObsidianBrackets(imagePath.trim());

  if (!cleanPath) {
    return "/posts/attachments/placeholder.jpg";
  }

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/posts/attachments/") || cleanPath.startsWith("/posts/")) {
    return getOptimizedFormat(cleanPath);
  }

  const isFileBased = cleanPath.startsWith("attachments/");

  if (isFileBased) {
    const imageName = cleanPath.replace("attachments/", "");
    return getOptimizedFormat(`/posts/attachments/${imageName}`);
  }

  if (postId && postSlug) {
    let imageName = cleanPath.startsWith("./") ? cleanPath.slice(2) : cleanPath;
    if (imageName.startsWith("images/") || imageName.startsWith("attachments/")) {
      imageName = imageName.replace(/^(images|attachments)\//, "");
    }
    return getOptimizedFormat(`/posts/${postSlug}/${imageName}`);
  }

  if (!cleanPath.includes("/")) {
    return getOptimizedFormat(`/posts/attachments/${cleanPath}`);
  }

  return getOptimizedFormat(`/posts/attachments/${cleanPath}`);
}

// Generic image optimization for all content types
export function optimizeContentImagePath(
  imagePath: string,
  contentType: "posts" | "projects" | "documentation" | "pages",
  contentSlug?: string,
  contentId?: string
): string {
  const urlPath = contentType === "documentation" ? "docs" : contentType;

  if (!imagePath || typeof imagePath !== "string") {
    return `/${urlPath}/attachments/placeholder.jpg`;
  }

  const cleanPath = stripObsidianBrackets(imagePath.trim());

  if (!cleanPath) {
    return `/${urlPath}/attachments/placeholder.jpg`;
  }

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/")) {
    return cleanPath;
  }

  if (cleanPath.startsWith(`/${urlPath}/attachments/`) || cleanPath.startsWith(`/${urlPath}/`)) {
    return getOptimizedFormat(cleanPath);
  }

  const isFileBased = cleanPath.startsWith("attachments/");

  if (isFileBased) {
    const imageName = cleanPath.replace("attachments/", "");
    return getOptimizedFormat(`/${urlPath}/attachments/${imageName}`);
  }

  let imageName = cleanPath.startsWith("./") ? cleanPath.slice(2) : cleanPath;
  if (imageName.startsWith("images/") || imageName.startsWith("attachments/")) {
    imageName = imageName.replace(/^(images|attachments)\//, "");
  }

  if (contentId && contentSlug) {
    return getOptimizedFormat(`/${urlPath}/${contentSlug}/${imageName}`);
  }

  return getOptimizedFormat(`/${urlPath}/attachments/${imageName}`);
}

// Converts image paths to WebP (sync-images.js creates WebP versions at build time)
export function getOptimizedFormat(imagePath: string): string {
  if (!imagePath ||
      imagePath.startsWith("http") ||
      imagePath.toLowerCase().endsWith(".svg") ||
      imagePath.toLowerCase().endsWith(".webp")) {
    return imagePath;
  }

  return imagePath.replace(/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i, ".webp");
}
