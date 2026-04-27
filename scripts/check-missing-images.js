#!/usr/bin/env node

/**
 * Script to check for missing images in content
 * Run with: node scripts/check-missing-images.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Get all markdown files in content directory
function getAllMarkdownFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|ico|avif)$/i;

// Extract image references from markdown content
function extractImageReferences(content) {
  const images = [];
  const lines = content.split('\n');

  // Match markdown images ![alt](src) — line by line for accurate line numbers
  for (let i = 0; i < lines.length; i++) {
    const mdMatches = [...lines[i].matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)];
    for (const m of mdMatches) {
      const src = m[1].trim();
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && IMAGE_EXTS.test(src)) {
        images.push({ type: 'markdown', src, line: i + 1 });
      }
    }

    // Match wikilink images ![[src]] or ![[src|caption|size]]
    const wikiMatches = [...lines[i].matchAll(/!\[\[([^\]]+)\]\]/g)];
    for (const m of wikiMatches) {
      const src = m[1].split('|')[0].trim();
      if (src && IMAGE_EXTS.test(src)) {
        images.push({ type: 'wikilink', src, line: i + 1 });
      }
    }
  }

  // Match frontmatter image field (exact key, non-empty value)
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const imageMatch = frontmatter.match(/^image:\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (imageMatch) {
      const src = imageMatch[1].trim();
      if (src && IMAGE_EXTS.test(src)) {
        images.push({ type: 'frontmatter', src, line: 1 });
      }
    }
  }

  return images;
}

// Check if image exists
function checkImageExists(imageSrc, filePath) {
  // Handle different image path formats
  let imagePath = imageSrc;
  
  // Remove Obsidian brackets
  if (imagePath.startsWith('[[') && imagePath.endsWith(']]')) {
    imagePath = imagePath.slice(2, -2);
  }
  
  // Determine content type and folder structure
  const isPostsFile = filePath.includes('posts');
  const isPagesFile = filePath.includes('pages');
  const isProjectsFile = filePath.includes('projects');
  const isDocsFile = filePath.includes('docs');
  const isFolderBasedPost = filePath.endsWith('index.md') && isPostsFile;
  const isFolderBasedProject = filePath.endsWith('index.md') && isProjectsFile;
  const isFolderBasedDoc = filePath.endsWith('index.md') && isDocsFile;
  
  // 1. Check in the same folder as the markdown file (for folder-based content)
  if (isFolderBasedPost || isFolderBasedProject || isFolderBasedDoc) {
    const contentDir = path.dirname(filePath);
    const sameFolderPath = path.join(contentDir, imagePath);
    if (fs.existsSync(sameFolderPath)) {
      return { exists: true, path: sameFolderPath };
    }
    
    // Check in /attachments/ subfolder within the content folder
    const imagesSubfolderPath = path.join(contentDir, 'images', imagePath);
    if (fs.existsSync(imagesSubfolderPath)) {
      return { exists: true, path: imagesSubfolderPath };
    }
  }
  
  // 2. Check in general images directory for each content type
  if (isPostsFile) {
    // src may already include 'attachments/' prefix or just the filename
    const relativeToPostsDir = path.join(projectRoot, 'src', 'content', 'posts', imagePath);
    if (fs.existsSync(relativeToPostsDir)) {
      return { exists: true, path: relativeToPostsDir };
    }
    const inAttachments = path.join(projectRoot, 'src', 'content', 'posts', 'attachments', imagePath);
    if (fs.existsSync(inAttachments)) {
      return { exists: true, path: inAttachments };
    }
  }

  if (isPagesFile) {
    const relativeToDir = path.join(projectRoot, 'src', 'content', 'bin', 'pages', imagePath);
    if (fs.existsSync(relativeToDir)) {
      return { exists: true, path: relativeToDir };
    }
  }

  if (isProjectsFile) {
    const relativeToDir = path.join(projectRoot, 'src', 'content', 'bin', 'projects', imagePath);
    if (fs.existsSync(relativeToDir)) {
      return { exists: true, path: relativeToDir };
    }
  }

  if (isDocsFile) {
    const relativeToDir = path.join(projectRoot, 'src', 'content', 'bin', 'docs', imagePath);
    if (fs.existsSync(relativeToDir)) {
      return { exists: true, path: relativeToDir };
    }
  }
  
  // 3. Check in public/posts/ (synced from src/content/posts/)
  if (isPostsFile) {
    const publicPath = path.join(projectRoot, 'public', 'posts', imagePath);
    if (fs.existsSync(publicPath)) {
      return { exists: true, path: publicPath };
    }
  }

  // 4. Check in public directory (for synced folder-based posts)
  if (isFolderBasedPost) {
    const postSlug = path.basename(path.dirname(filePath));
    const publicPath = path.join(projectRoot, 'public', 'posts', postSlug, imagePath);
    if (fs.existsSync(publicPath)) {
      return { exists: true, path: publicPath };
    }
  }
  
  if (isFolderBasedProject) {
    const projectSlug = path.basename(path.dirname(filePath));
    const publicPath = path.join(projectRoot, 'public', 'projects', projectSlug, imagePath);
    if (fs.existsSync(publicPath)) {
      return { exists: true, path: publicPath };
    }
  }
  
  if (isFolderBasedDoc) {
    const docSlug = path.basename(path.dirname(filePath));
    const publicPath = path.join(projectRoot, 'public', 'docs', docSlug, imagePath);
    if (fs.existsSync(publicPath)) {
      return { exists: true, path: publicPath };
    }
  }
  
  // Handle absolute paths (starting with /)
  if (imagePath.startsWith('/')) {
    const publicPath = path.join(projectRoot, 'public', imagePath);
    if (fs.existsSync(publicPath)) {
      return { exists: true, path: publicPath };
    }
  }
  
  // Handle relative paths from public directory
  const publicPath = path.join(projectRoot, 'public', imagePath);
  if (fs.existsSync(publicPath)) {
    return { exists: true, path: publicPath };
  }
  
  // Handle external URLs (don't check these)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return { exists: true, path: imagePath };
  }
  
  return { exists: false, path: imagePath };
}

// Main function
function main() {
  console.log('🔍 Checking for missing images...\n');
  
  const contentDir = path.join(projectRoot, 'src', 'content');
  const markdownFiles = getAllMarkdownFiles(contentDir);
  
  let totalImages = 0;
  let missingImages = 0;
  const missingImageDetails = [];
  
  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const images = extractImageReferences(content);
    
    for (const image of images) {
      totalImages++;
      const result = checkImageExists(image.src, filePath);
      
      if (!result.exists) {
        missingImages++;
        const relativePath = path.relative(projectRoot, filePath);
        missingImageDetails.push({
          file: relativePath,
          line: image.line,
          type: image.type,
          src: image.src,
          expectedPath: result.path
        });
      }
    }
  }
  
  // Report results
  console.log(`📊 Summary:`);
  console.log(`   Total images: ${totalImages}`);
  console.log(`   Missing images: ${missingImages}`);
  console.log(`   Found images: ${totalImages - missingImages}\n`);
  
  if (missingImages > 0) {
    console.log('❌ Missing images:');
    for (const detail of missingImageDetails) {
      console.log(`   ${detail.file}:${detail.line} (${detail.type})`);
      console.log(`     src: ${detail.src}`);
      console.log(`     expected: ${detail.expectedPath}\n`);
    }

    // Write machine-readable report
    const reportPath = path.join(projectRoot, 'missing-images-report.txt');
    const lines = missingImageDetails.map(d =>
      `${d.file}:${d.line}\t${d.type}\t${d.src}\t${d.expectedPath}`
    );
    fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf-8');
    console.log(`\n📄 Report written to: missing-images-report.txt`);
  } else {
    console.log('✅ All images found!');
  }
}

main();
