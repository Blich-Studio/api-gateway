# Blich Studio API Gateway

The API Gateway for Blich Studio, built with [NestJS](https://nestjs.com/). This service acts as the entry point for client applications, aggregating data from various microservices (like the CMS API) and providing a unified GraphQL and REST interface.

## Features

- **GraphQL Interface**: Aggregates data from backend services (e.g., CMS API) into a single GraphQL schema.
- **Authentication**: JWT-based authentication strategy.
- **Security**: Implements best practices using `helmet` and rate limiting.
- **Standardized Responses**: Global interceptors and exception filters for consistent API responses.
- **Documentation**: Auto-generated Swagger/OpenAPI documentation.

## Prerequisites

- Node.js (v18 or later)
- [Bun 1.1+](https://bun.sh/) for dependency management and scripts
- Running instance of `cms-api` (default: http://localhost:3001)

## Installation

```bash
$ bun install
```

## Running the app

```bash
# development
$ bun run start

# watch mode
$ bun run start:dev

# production mode
$ bun run start:prod
```

## Test

```bash
# unit tests
$ bun run test

# e2e tests
$ bun run test:e2e

# test coverage
$ bun run test:cov
```

## Documentation

### Swagger / OpenAPI

Once the application is running, you can access the Swagger documentation at:
http://localhost:3000/api/v1/docs

### GraphQL Playground

The GraphQL Playground is available at:
http://localhost:3000/graphql

## Environment Variables

Create a `.env` file in the root of the application (if not using the global configuration). The gateway now throws a `MissingEnvironmentVariableError` during boot if any of the following values are absent or invalid:

```env
PORT=3000
CMS_API_URL=http://localhost:3001
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=60m
SUPABASE_URL=https://your-supabase-instance.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key
```

Adjust the values to match your local Supabase project and CMS API endpoint before running `bun run start:dev` or the e2e tests.

### Authentication Workflows

- **GraphQL (`/graphql`)**: `registerUser` and `loginUser` mutations authenticate Supabase users (web clients) and return gateway JWTs embedding the CMS role.
- **REST (`/api/v1/admin/auth/login`)**: Admin panel sessions exchange Supabase credentials for a JWT that can call the protected editorial proxy routes listed below.

### REST Endpoints

| Method   | Path                          | Description                                                                                          |
| -------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/admin/auth/login`    | Authenticates an admin via Supabase credentials and issues a gateway-scoped JWT.                     |
| `PATCH`  | `/api/v1/articles/:articleId` | Updates an article. Admins can edit everything; writers are limited to their own articles.           |
| `PATCH`  | `/api/v1/comments/:commentId` | Updates a comment. Admins can edit everything; readers and writers can only edit their own comments. |
| `DELETE` | `/api/v1/tags/:tagId`         | Deletes a tag. Only admins are allowed.                                                              |
| `POST`   | `/api/v1/tags`                | Creates a tag. Only admins are allowed.                                                              |

All REST routes return `{ "data": ... }` payloads via the global `TransformInterceptor` and require a Bearer token produced by the `/admin/auth/login` endpoint.

## Architecture

This gateway uses the **BFF (Backend for Frontend)** pattern. It is responsible for:

1.  Authenticating users.
2.  Routing requests to appropriate microservices.
3.  Aggregating and transforming data for the frontend.

### Modules

- **AuthModule**: Handles Supabase-backed admin authentication and JWT issuance for downstream modules.
- **EditorialModule**: Proxies editorial REST operations (articles, comments, tags) to the CMS API while enforcing role-based access rules.
- **ArticlesModule**: Exposes article data via GraphQL, fetching from the CMS API.
- **UsersModule**: Persists CMS user records through POST/GET proxies and centralizes role/ownership helpers for GraphQL and REST flows.
