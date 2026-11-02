# Supabase setup

Portify uses Supabase Auth and `public.portfolios`. Account owners can manage
multiple portfolios. Published portfolios can be viewed by anyone using their
unique slug; unpublished portfolios remain private. Row-level security enforces
these rules in the database, not just in the browser UI.

## MCP and the website

The Supabase MCP server in the workspace `.mcp.json` connects the IDE assistant
to the Supabase project for development tasks. It is not a web API and should
not be called by browser code. The website itself connects to Supabase through
the official `supabase-js` browser client configured in `config.js`, using the
project URL and publishable key. These are separate connections to the same
project.

## Configure the backend

1. Open the Supabase project whose URL and publishable key are in `config.js`.
2. In the Supabase SQL Editor, run `schema.sql`. It creates the current schema
   and migrates rows from the earlier Portify table that used `owner_id` and
   `project_name`.
3. In **Authentication → Providers**, enable Email sign-in. Configure email
   confirmation and the allowed redirect URLs for the site you deploy.
4. Ensure the project API settings use the publishable key from **Project
   Settings → API Keys**. A publishable key is intended for browser use;
   never put a `service_role` or secret key in this website.
5. Serve the site over localhost or HTTPS. Do not rely on `file://` for hosted
   authentication redirects.

If using a different Supabase project, replace the URL and publishable key in
`config.js`. The URL must be the project root (for example,
`https://<project-ref>.supabase.co`), not the `/rest/v1/` endpoint.

## Data model

The app stores multiple portfolio rows per account. The `user_id` is the
authenticated Supabase user ID. RLS permits users to manage their own rows and
permits anonymous read access only to rows where `is_published` is true. Each
published portfolio is opened with `?portfolio=<slug>`.

Projects are stored as JSON objects with `name` and `description` properties.
The browser editor reads and writes this shape. The initial migration converts
the previous single `project_name` value into a one-item project array.
