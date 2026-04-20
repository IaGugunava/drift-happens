import { fieldOperators } from './rule-node.type';
import type { FieldOperator, RuleNode } from './rule-node.type';

export class RuleNodeValidationError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'RuleNodeValidationError';
  }
}

const fieldOperatorSet = new Set<FieldOperator>(fieldOperators);

export function isRuleNode(value: unknown): value is RuleNode {
  return validateRuleNode(value).success;
}

export function assertRuleNode(value: unknown): asserts value is RuleNode {
  const result = validateRuleNode(value);

  if (!result.success) {
    throw result.error;
  }
}

export function validateRuleNode(
  value: unknown,
  path = 'rule',
): { success: true } | { success: false; error: RuleNodeValidationError } {
  if (!isPlainObject(value)) {
    return failure(path, 'must be an object');
  }

  if (!isNonEmptyString(value.type)) {
    return failure(path, 'must include a non-empty "type"');
  }

  switch (value.type) {
    case 'AND':
    case 'OR':
      return validateLogicalChildrenRule(value, path);
    case 'NOT':
      return validateNotRule(value, path);
    case 'FIELD':
      return validateFieldRule(value, path);
    case 'DATE_WITHIN':
    case 'DATE_OLDER':
      return validateDateRule(value, path);
    case 'IN_SEGMENT':
      return validateInSegmentRule(value, path);
    default:
      return failure(path, `has unsupported rule type "${value.type}"`);
  }
}

export function collectSegmentDependencies(rule: RuleNode): string[] {
  const dependencies = new Set<string>();
  collectDependenciesInto(rule, dependencies);
  return [...dependencies];
}

function collectDependenciesInto(rule: RuleNode, dependencies: Set<string>): void {
  switch (rule.type) {
    case 'AND':
    case 'OR':
      for (const child of rule.children) {
        collectDependenciesInto(child, dependencies);
      }
      return;
    case 'NOT':
      collectDependenciesInto(rule.child, dependencies);
      return;
    case 'IN_SEGMENT':
      dependencies.add(rule.segmentId);
      return;
    default:
      return;
  }
}

function validateLogicalChildrenRule(
  value: Record<string, unknown>,
  path: string,
): { success: true } | { success: false; error: RuleNodeValidationError } {
  if (!Array.isArray(value.children) || value.children.length === 0) {
    return failure(`${path}.children`, 'must be a non-empty array');
  }

  for (let index = 0; index < value.children.length; index += 1) {
    const result = validateRuleNode(value.children[index], `${path}.children[${index}]`);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}

function validateNotRule(
  value: Record<string, unknown>,
  path: string,
): { success: true } | { success: false; error: RuleNodeValidationError } {
  if (!('child' in value)) {
    return failure(`${path}.child`, 'is required');
  }

  return validateRuleNode(value.child, `${path}.child`);
}

function validateFieldRule(
  value: Record<string, unknown>,
  path: string,
): { success: true } | { success: false; error: RuleNodeValidationError } {
  if (!isNonEmptyString(value.field)) {
    return failure(`${path}.field`, 'must be a non-empty string');
  }

  if (!isFieldOperator(value.op)) {
    return failure(`${path}.op`, 'must be one of eq, gt, lt, gte, lte, contains');
  }

  if (!('value' in value) || value.value === undefined) {
    return failure(`${path}.value`, 'is required');
  }

  return { success: true };
}

function validateDateRule(
  value: Record<string, unknown>,
  path: string,
): { success: true } | { success: false; error: RuleNodeValidationError } {
  if (!isNonEmptyString(value.field)) {
    return failure(`${path}.field`, 'must be a non-empty string');
  }

  if (!isPositiveInteger(value.days)) {
    return failure(`${path}.days`, 'must be a positive integer');
  }

  return { success: true };
}

function validateInSegmentRule(
  value: Record<string, unknown>,
  path: string,
): { success: true } | { success: false; error: RuleNodeValidationError } {
  if (!isNonEmptyString(value.segmentId)) {
    return failure(`${path}.segmentId`, 'must be a non-empty string');
  }

  return { success: true };
}

function failure(
  path: string,
  message: string,
): { success: false; error: RuleNodeValidationError } {
  return {
    success: false,
    error: new RuleNodeValidationError(path, message),
  };
}

function isFieldOperator(value: unknown): value is FieldOperator {
  return typeof value === 'string' && fieldOperatorSet.has(value as FieldOperator);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
