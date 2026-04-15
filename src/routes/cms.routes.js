const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { body, validationResult } = require('express-validator');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ============================================================
// SITE CONTENT (stored in SiteConfig)
// ============================================================

// GET /api/cms/content - Get all site content as key-value pairs (public)
router.get('/content', async (req, res) => {
  try {
    const configs = await prisma.siteConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Transform key-value pairs into a nested object for easier frontend consumption
    const content = {};
    configs.forEach((config) => {
      const parts = config.key.split('.');
      if (parts.length === 1) {
        content[parts[0]] = config.value;
      } else {
        const parentKey = parts[0];
        const childKey = parts.slice(1).join('.');
        if (!content[parentKey]) {
          content[parentKey] = {};
        }
        content[parentKey][childKey] = config.value;
      }
    });

    res.json({ content, raw: configs });
  } catch (error) {
    console.error('Error fetching site content:', error);
    res.status(500).json({ error: 'Error al obtener la configuracion del sitio' });
  }
});

// PUT /api/cms/content - Update multiple content fields (admin only)
router.put(
  '/content',
  authMiddleware,
  adminMiddleware,
  [body('content').isObject().withMessage('content debe ser un objeto')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content } = req.body;
      const updates = [];

      // Flatten nested object into dot-notation keys
      function flatten(obj, prefix = '') {
        const result = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              Object.assign(result, flatten(obj[key], fullKey));
            } else {
              result[fullKey] = String(obj[key]);
            }
          }
        }
        return result;
      }

      const flattened = flatten(content);

      for (const [key, value] of Object.entries(flattened)) {
        updates.push(
          prisma.siteConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        );
      }

      await prisma.$transaction(updates);

      // Fetch updated content
      const configs = await prisma.siteConfig.findMany({ orderBy: { key: 'asc' } });
      const result = {};
      configs.forEach((config) => {
        const parts = config.key.split('.');
        if (parts.length === 1) {
          result[parts[0]] = config.value;
        } else {
          const parentKey = parts[0];
          const childKey = parts.slice(1).join('.');
          if (!result[parentKey]) result[parentKey] = {};
          result[parentKey][childKey] = config.value;
        }
      });

      res.json({ content: result, message: 'Contenido actualizado correctamente' });
    } catch (error) {
      console.error('Error updating site content:', error);
      res.status(500).json({ error: 'Error al actualizar la configuracion del sitio' });
    }
  }
);

// PUT /api/cms/content/:key - Update single content field (admin only)
router.put(
  '/content/:key',
  authMiddleware,
  adminMiddleware,
  [body('value').notEmpty().withMessage('El valor es requerido')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { key } = req.params;
      const { value } = req.body;

      const config = await prisma.siteConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });

      res.json({ content: { [key]: config.value }, message: 'Campo actualizado correctamente' });
    } catch (error) {
      console.error('Error updating content field:', error);
      res.status(500).json({ error: 'Error al actualizar el campo' });
    }
  }
);

// ============================================================
// BLOG POSTS
// ============================================================

// GET /api/cms/blog - Get all blog posts (public)
router.get('/blog', async (req, res) => {
  try {
    const { published } = req.query;

    const where = {};
    if (published === 'true') {
      where.published = true;
    }

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Error al obtener las publicaciones del blog' });
  }
});

// GET /api/cms/blog/:id - Get single blog post (public)
router.get('/blog/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({ error: 'Publicacion del blog no encontrada' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Error al obtener la publicacion del blog' });
  }
});

// POST /api/cms/blog - Create blog post (admin only)
router.post(
  '/blog',
  authMiddleware,
  adminMiddleware,
  [
    body('title').trim().notEmpty().withMessage('El titulo es requerido'),
    body('excerpt').trim().notEmpty().withMessage('El extracto es requerido'),
    body('content').trim().notEmpty().withMessage('El contenido es requerido'),
    body('author').trim().notEmpty().withMessage('El autor es requerido'),
    body('image').optional().isURL().withMessage('La imagen debe ser una URL valida'),
    body('published').optional().isBoolean().withMessage('published debe ser un booleano'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, excerpt, content, author, image, tags, published } = req.body;

      const post = await prisma.blogPost.create({
        data: {
          title,
          excerpt,
          content,
          author,
          image: image || null,
          tags: tags || null,
          published: published || false,
        },
      });

      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating blog post:', error);
      res.status(500).json({ error: 'Error al crear la publicacion del blog' });
    }
  }
);

// PUT /api/cms/blog/:id - Update blog post (admin only)
router.put(
  '/blog/:id',
  authMiddleware,
  adminMiddleware,
  [
    body('title').optional().trim().notEmpty().withMessage('El titulo no puede estar vacio'),
    body('excerpt').optional().trim().notEmpty().withMessage('El extracto no puede estar vacio'),
    body('content').optional().trim().notEmpty().withMessage('El contenido no puede estar vacio'),
    body('author').optional().trim().notEmpty().withMessage('El autor no puede estar vacio'),
    body('image').optional().isURL().withMessage('La imagen debe ser una URL valida'),
    body('published').optional().isBoolean().withMessage('published debe ser un booleano'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { title, excerpt, content, author, image, tags, published } = req.body;

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (excerpt !== undefined) updateData.excerpt = excerpt;
      if (content !== undefined) updateData.content = content;
      if (author !== undefined) updateData.author = author;
      if (image !== undefined) updateData.image = image;
      if (tags !== undefined) updateData.tags = tags;
      if (published !== undefined) updateData.published = published;

      const post = await prisma.blogPost.update({
        where: { id },
        data: updateData,
      });

      res.json(post);
    } catch (error) {
      console.error('Error updating blog post:', error);
      res.status(500).json({ error: 'Error al actualizar la publicacion del blog' });
    }
  }
);

// DELETE /api/cms/blog/:id - Delete blog post (admin only)
router.delete('/blog/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.blogPost.delete({
      where: { id },
    });

    res.json({ message: 'Publicacion del blog eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Error al eliminar la publicacion del blog' });
  }
});

// ============================================================
// PAGES
// ============================================================

// GET /api/cms/pages - Get all pages (public)
router.get('/pages', async (req, res) => {
  try {
    const { active } = req.query;

    const where = {};
    if (active === 'true') {
      where.active = true;
    }

    const pages = await prisma.page.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(pages);
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: 'Error al obtener las paginas' });
  }
});

// GET /api/cms/pages/:id - Get single page (public)
router.get('/pages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try by UUID first, then by path
    const page = await prisma.page.findFirst({
      where: {
        OR: [{ id }, { path: id }],
      },
    });

    if (!page) {
      return res.status(404).json({ error: 'Pagina no encontrada' });
    }

    res.json(page);
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Error al obtener la pagina' });
  }
});

// POST /api/cms/pages - Create page (admin only)
router.post(
  '/pages',
  authMiddleware,
  adminMiddleware,
  [
    body('name').trim().notEmpty().withMessage('El nombre es requerido'),
    body('path').trim().notEmpty().withMessage('La ruta es requerida'),
    body('pageTitle').trim().notEmpty().withMessage('El titulo de la pagina es requerido'),
    body('pageSubtitle').trim().notEmpty().withMessage('El subtitulo es requerido'),
    body('pageText').trim().notEmpty().withMessage('El texto de la pagina es requerido'),
    body('pageImage').optional().isURL().withMessage('La imagen debe ser una URL valida'),
    body('active').optional().isBoolean().withMessage('active debe ser un booleano'),
    body('isCustom').optional().isBoolean().withMessage('isCustom debe ser un booleano'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, path, pageTitle, pageSubtitle, pageText, pageImage, active, isCustom } =
        req.body;

      // Ensure path starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      const page = await prisma.page.create({
        data: {
          name,
          path: normalizedPath,
          pageTitle,
          pageSubtitle,
          pageText,
          pageImage: pageImage || null,
          active: active || false,
          isCustom: isCustom !== undefined ? isCustom : true,
        },
      });

      res.status(201).json(page);
    } catch (error) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Ya existe una pagina con esa ruta' });
      }

      console.error('Error creating page:', error);
      res.status(500).json({ error: 'Error al crear la pagina' });
    }
  }
);

// PUT /api/cms/pages/:id - Update page (admin only)
router.put(
  '/pages/:id',
  authMiddleware,
  adminMiddleware,
  [
    body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacio'),
    body('path').optional().trim().notEmpty().withMessage('La ruta no puede estar vacia'),
    body('pageTitle').optional().trim().notEmpty().withMessage('El titulo no puede estar vacio'),
    body('pageSubtitle').optional().trim().notEmpty().withMessage('El subtitulo no puede estar vacio'),
    body('pageText').optional().trim().notEmpty().withMessage('El texto no puede estar vacio'),
    body('pageImage').optional().isURL().withMessage('La imagen debe ser una URL valida'),
    body('active').optional().isBoolean().withMessage('active debe ser un booleano'),
    body('isCustom').optional().isBoolean().withMessage('isCustom debe ser un booleano'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, path, pageTitle, pageSubtitle, pageText, pageImage, active, isCustom } =
        req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (path !== undefined) {
        updateData.path = path.startsWith('/') ? path : `/${path}`;
      }
      if (pageTitle !== undefined) updateData.pageTitle = pageTitle;
      if (pageSubtitle !== undefined) updateData.pageSubtitle = pageSubtitle;
      if (pageText !== undefined) updateData.pageText = pageText;
      if (pageImage !== undefined) updateData.pageImage = pageImage;
      if (active !== undefined) updateData.active = active;
      if (isCustom !== undefined) updateData.isCustom = isCustom;

      const page = await prisma.page.update({
        where: { id },
        data: updateData,
      });

      res.json(page);
    } catch (error) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Ya existe una pagina con esa ruta' });
      }

      console.error('Error updating page:', error);
      res.status(500).json({ error: 'Error al actualizar la pagina' });
    }
  }
);

// DELETE /api/cms/pages/:id - Delete page (admin only)
router.delete('/pages/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.page.delete({
      where: { id },
    });

    res.json({ message: 'Pagina eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Error al eliminar la pagina' });
  }
});

// ============================================================
// THEME
// ============================================================

// GET /api/cms/theme - Get all theme settings (public)
router.get('/theme', async (req, res) => {
  try {
    const configs = await prisma.themeConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Transform key-value pairs into a nested object for easier frontend consumption
    const theme = {};
    configs.forEach((config) => {
      const parts = config.key.split('.');
      if (parts.length === 1) {
        theme[parts[0]] = config.value;
      } else {
        const parentKey = parts[0];
        const childKey = parts.slice(1).join('.');
        if (!theme[parentKey]) {
          theme[parentKey] = {};
        }
        theme[parentKey][childKey] = config.value;
      }
    });

    res.json({ theme, raw: configs });
  } catch (error) {
    console.error('Error fetching theme settings:', error);
    res.status(500).json({ error: 'Error al obtener la configuracion del tema' });
  }
});

// PUT /api/cms/theme - Update theme (admin only)
router.put(
  '/theme',
  authMiddleware,
  adminMiddleware,
  [body('theme').isObject().withMessage('theme debe ser un objeto')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { theme } = req.body;
      const updates = [];

      // Flatten nested object into dot-notation keys
      function flatten(obj, prefix = '') {
        const result = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              Object.assign(result, flatten(obj[key], fullKey));
            } else {
              result[fullKey] = String(obj[key]);
            }
          }
        }
        return result;
      }

      const flattened = flatten(theme);

      for (const [key, value] of Object.entries(flattened)) {
        updates.push(
          prisma.themeConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        );
      }

      await prisma.$transaction(updates);

      // Fetch updated theme
      const configs = await prisma.themeConfig.findMany({ orderBy: { key: 'asc' } });
      const result = {};
      configs.forEach((config) => {
        const parts = config.key.split('.');
        if (parts.length === 1) {
          result[parts[0]] = config.value;
        } else {
          const parentKey = parts[0];
          const childKey = parts.slice(1).join('.');
          if (!result[parentKey]) result[parentKey] = {};
          result[parentKey][childKey] = config.value;
        }
      });

      res.json({ theme: result, message: 'Tema actualizado correctamente' });
    } catch (error) {
      console.error('Error updating theme:', error);
      res.status(500).json({ error: 'Error al actualizar la configuracion del tema' });
    }
  }
);

module.exports = router;
