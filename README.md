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
- npm or pnpm
- Running instance of `cms-api` (default: http://localhost:3001)

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Documentation

### Swagger / OpenAPI

Once the application is running, you can access the Swagger documentation at:
http://localhost:3000/api/v1/docs

### GraphQL Playground

The GraphQL Playground is available at:
http://localhost:3000/graphql

## Environment Variables

Create a `.env` file in the root of the application (if not using the global configuration):

```env
PORT=3000
CMS_API_URL=http://localhost:3001
JWT_SECRET=your-secret-key
```

## Architecture

This gateway uses the **BFF (Backend for Frontend)** pattern. It is responsible for:

1.  Authenticating users.
2.  Routing requests to appropriate microservices.
3.  Aggregating and transforming data for the frontend.

### Modules

- **AuthModule**: Handles JWT authentication.
- **ArticlesModule**: Exposes Article data via GraphQL, fetching from the CMS API.
