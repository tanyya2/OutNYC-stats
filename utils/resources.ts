// The simple admin tables: one entry each, and /[resource] pages list, create, edit and
// delete rows from this config. Pages with their own layout (prompt chains, chain mix,
// generation requests, LLM responses, images) live in their own folders.

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "checkbox" | "select";
  required?: boolean;
  max?: number;
  // select: rows of this table become the options (id → label column)
  options?: { table: string; label: string };
  help?: string;
};

export type Resource = {
  table: string;
  title: string;
  // One row, for "New …" / "Delete this …"
  noun: string;
  description: string;
  fields: Field[];
  // Columns shown in the list, after the id
  columns: string[];
  orderBy: { column: string; ascending: boolean };
};

export const RESOURCES = {
  "llm-providers": {
    table: "llm_providers",
    title: "LLM providers",
    noun: "provider",
    description: "AI companies whose models OutNYC uses now or may use later.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 80 },
      { name: "api_base_url", label: "API base URL", type: "text", max: 300 },
    ],
    columns: ["name", "api_base_url", "created_at"],
    orderBy: { column: "id", ascending: true },
  },
  "llm-models": {
    table: "llm_models",
    title: "LLM models",
    noun: "model",
    description: "AI models for writing plans. Not implemented yet.",
    fields: [
      { name: "provider_id", label: "Provider", type: "select", required: true, options: { table: "llm_providers", label: "name" } },
      { name: "name", label: "API name", type: "text", required: true, max: 120, help: "Exactly as the provider's API expects it, e.g. gemini-2.5-flash." },
      { name: "label", label: "Display name", type: "text", max: 120 },
      { name: "sort_order", label: "Order", type: "number", required: true, help: "Lower numbers come first." },
      { name: "thinking_off", label: "Turn off extended thinking (faster)", type: "checkbox" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
    columns: ["name", "label", "provider_id", "sort_order", "is_active"],
    orderBy: { column: "sort_order", ascending: true },
  },
  terms: {
    table: "terms",
    title: "Terms",
    noun: "term",
    description: "NYC words and places for the AI to understand and use in plans. Not implemented yet.",
    fields: [
      { name: "term", label: "Term", type: "text", required: true, max: 80 },
      { name: "definition", label: "Definition", type: "textarea", required: true, max: 500 },
      { name: "example", label: "Example", type: "textarea", max: 500 },
    ],
    columns: ["term", "definition", "created_at"],
    orderBy: { column: "term", ascending: true },
  },
  "generation-examples": {
    table: "generation_examples",
    title: "AI generation examples",
    noun: "example",
    description: "Sample requests with the plan we'd want back, to show the AI what a good plan looks like. Not implemented yet.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 120 },
      { name: "request", label: "Request", type: "textarea", required: true, max: 500, help: "What the user asked for: place, time, budget, what for." },
      { name: "example_plan", label: "Example plan", type: "textarea", required: true, max: 3000 },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
    columns: ["title", "request", "is_active"],
    orderBy: { column: "id", ascending: true },
  },
  "signup-domains": {
    table: "allowed_signup_domains",
    title: "Allowed sign-up domains",
    noun: "domain",
    description: "Email domains that will be allowed to sign up. Not implemented yet.",
    fields: [{ name: "domain", label: "Domain", type: "text", required: true, max: 120, help: "Without the @, e.g. columbia.edu." }],
    columns: ["domain", "created_at"],
    orderBy: { column: "domain", ascending: true },
  },
  "whitelisted-emails": {
    table: "whitelist_email_addresses",
    title: "Whitelisted emails",
    noun: "email",
    description: "Email addresses that will be allowed to sign up even if their domain isn't on the list. Not implemented yet.",
    fields: [
      { name: "email", label: "Email", type: "text", required: true, max: 200 },
      { name: "note", label: "Note", type: "text", max: 200, help: "Who this is, for your own reference." },
    ],
    columns: ["email", "note", "created_at"],
    orderBy: { column: "email", ascending: true },
  },
} satisfies Record<string, Resource>;

export type ResourceKey = keyof typeof RESOURCES;

export function getResource(key: string): Resource | null {
  return Object.hasOwn(RESOURCES, key) ? RESOURCES[key as ResourceKey] : null;
}

// Column name → heading, for list tables
export function columnLabel(resource: Resource, column: string) {
  if (column === "created_at") return "Added";
  return resource.fields.find((field) => field.name === column)?.label ?? column;
}

type Values = Record<string, string | number | boolean | null>;

// Reads and checks a form against the config. Returns the row to save, or an error to show.
export function readFields(resource: Resource, formData: FormData): { values: Values } | { error: string } {
  const values: Values = {};
  for (const field of resource.fields) {
    const raw = String(formData.get(field.name) ?? "").trim();
    if (field.type === "checkbox") {
      values[field.name] = formData.get(field.name) === "on";
      continue;
    }
    if (!raw) {
      if (field.required) return { error: `${field.label} is required.` };
      values[field.name] = null;
      continue;
    }
    if (field.type === "number" || field.type === "select") {
      const n = Number(raw);
      if (!Number.isInteger(n)) return { error: `${field.label} must be a whole number.` };
      values[field.name] = n;
      continue;
    }
    if (field.max && raw.length > field.max) return { error: `Keep ${field.label.toLowerCase()} under ${field.max} characters.` };
    values[field.name] = raw;
  }

  // Domains and emails: lowercase, so "Columbia.edu" and "columbia.edu" are the same
  if (resource.table === "allowed_signup_domains") {
    const domain = String(values.domain).toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return { error: "That doesn't look like a domain (e.g. columbia.edu)." };
    values.domain = domain;
  }
  if (resource.table === "whitelist_email_addresses") {
    const email = String(values.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That doesn't look like an email address." };
    values.email = email;
  }
  return { values };
}
