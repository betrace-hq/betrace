export interface Rule {
  id?: string;
  name: string;
  description: string;
  severity?: string;  // HIGH, MEDIUM, LOW
  expression: string;  // BeTrace DSL expression (matches backend)
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}
