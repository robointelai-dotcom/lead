# LeadFlow Pro — Test Credentials

## Login
- **URL**: http://localhost:3000/login
- **Email**: `admin@acme.com`
- **Password**: `password123`
- **Role**: OWNER
- **Organization**: Acme Lead Agency

## Additional Seeded Users
| Email | Password | Role |
|---|---|---|
| `admin@acme.com`  | `password123` | OWNER |
| `sarah@acme.com`  | `password123` | MANAGER |
| `mike@acme.com`   | `password123` | AGENT |

## Local Infra
- **Postgres**: `postgresql://leadflow:leadflowpass@localhost:5432/leadflow_db`
- **Redis**: `redis://localhost:6379`

## Integration Test Tokens (for the Integrations UI)
- **GitHub**: paste `MOCK_TOKEN` — dispatcher will short-circuit and log a mock success (no live HTTP call)
- **Gemini / OpenAI / Google Places / GHL / Callfluent**: any string (encrypted at rest with AES-256-GCM). Real live keys can be pasted here for production.

## Webhook URLs (for external services)
- **Callfluent post-call**: `POST /api/webhooks/callfluent`
- **Integrations save**: `POST /api/integrations/save`
