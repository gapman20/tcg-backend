# TCG Backend

Backend API para e-commerce de Trading Card Games.

## Stack Tecnológico

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **ORM:** Prisma
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT

## Requisitos

- Node.js 18+
- PostgreSQL 14+

## Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd tcg-backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. **Crear la base de datos PostgreSQL**
```sql
CREATE DATABASE tcg_database;
```

5. **Generar cliente Prisma y crear tablas**
```bash
npm run db:push
npm run db:seed
```

6. **Iniciar el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

El servidor estará en `http://localhost:3001`

## Endpoints API

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login de usuario
- `POST /api/auth/admin/login` - Login de admin
- `GET /api/auth/verify` - Verificar token

### Usuarios
- `GET /api/users/profile` - Perfil del usuario (auth)
- `PUT /api/users/profile` - Actualizar perfil (auth)
- `PUT /api/users/password` - Cambiar password (auth)

### Juegos
- `GET /api/games` - Listar juegos
- `GET /api/games/:id` - Obtener juego

### Cartas
- `GET /api/cards` - Listar cartas (filtros: game, search, rarity, condition, minPrice, maxPrice, inStock, page, limit, sort, order)
- `GET /api/cards/:id` - Obtener carta
- `POST /api/cards` - Crear carta (admin)
- `PUT /api/cards/:id` - Actualizar carta (admin)
- `DELETE /api/cards/:id` - Eliminar carta (admin)

### Productos Sellados
- `GET /api/products` - Listar productos (filtros: game, type, badge, inStock, page, limit, sort, order)
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Actualizar producto (admin)
- `DELETE /api/products/:id` - Eliminar producto (admin)

### Pedidos
- `POST /api/orders` - Crear pedido
- `GET /api/orders/my-orders` - Mis pedidos (auth)
- `GET /api/orders/:id` - Obtener pedido
- `GET /api/orders` - Listar pedidos (admin)
- `PUT /api/orders/:id/status` - Actualizar estado (admin)

### Wishlist
- `GET /api/wishlist` - Mi wishlist (auth)
- `POST /api/wishlist` - Agregar a wishlist (auth)
- `DELETE /api/wishlist/:cardId` - Quitar de wishlist (auth)

## Credenciales Admin

Por defecto:
- Email: `admin@tcg.com`
- Password: `admin123`

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar en desarrollo (con nodemon) |
| `npm start` | Iniciar en producción |
| `npm run db:generate` | Generar cliente Prisma |
| `npm run db:push` | Sincronizar schema con DB |
| `npm run db:migrate` | Crear/actualizar migraciones |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:seed` | Poblar base de datos |

## Estructura del Proyecto

```
tcg-backend/
├── prisma/
│   ├── schema.prisma    # Definición de modelos
│   └── seed.js         # Datos iniciales
├── src/
│   ├── index.js        # Entry point
│   ├── middleware/
│   │   └── auth.js    # Middleware de autenticación
│   └── routes/
│       ├── auth.routes.js
│       ├── user.routes.js
│       ├── game.routes.js
│       ├── card.routes.js
│       ├── product.routes.js
│       ├── order.routes.js
│       └── wishlist.routes.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Integración con Frontend

El frontend actual está configurado para usar `src/services/api.js`. Reemplaza las funciones de localStorage por llamadas a esta API:

```javascript
const API_URL = 'http://localhost:3001/api';

// Ejemplo de obtener cartas
const response = await fetch(`${API_URL}/cards?game=pokemon`);
const { cards } = await response.json();
```

## Deploy

### Railway
1. Conectar repo de GitHub
2. Agregar variable `DATABASE_URL`
3. Railway detectará Prisma y ejecutará migraciones

### Render
1. Crear Web Service
2. Configurar build command: `npm run db:push && npm run db:seed`
3. Start command: `npm start`
4. Agregar variable `DATABASE_URL`

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Licencia

ISC
