import React from "react";
import { Button } from "./Button";
import { Input } from "./form/Input";
import { Select, SelectOption } from "./form/Select";
import { colors, spacing } from "./tokens";

export interface RuleBuilderConditionType {
  value: string;
  label: string;
}

export interface RuleBuilderOperator {
  value: string;
  label: string;
}

export interface RuleBuilderRule {
  conditionType: string;
  operator: string;
  value: string;
}

export interface RuleBuilderProps {
  rules: RuleBuilderRule[];
  conditionTypes: RuleBuilderConditionType[];
  operators: RuleBuilderOperator[];
  onChange: (rules: RuleBuilderRule[]) => void;
}

const EMPTY_RULE: RuleBuilderRule = { conditionType: "", operator: "eq", value: "" };

/**
 * A generic AND-only rule list editor — each row picks a condition type,
 * operator, and value. Used by the segment builder; the `in` operator's
 * value is comma-separated and split by the caller before submit.
 */
export function RuleBuilder({ rules, conditionTypes, operators, onChange }: RuleBuilderProps) {
  const operatorOptions: SelectOption[] = operators.map((o) => ({ value: o.value, label: o.label }));
  const conditionTypeOptions: SelectOption[] = conditionTypes.map((c) => ({ value: c.value, label: c.label }));

  function updateRule(index: number, patch: Partial<RuleBuilderRule>) {
    const next = rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule));
    onChange(next);
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function addRule() {
    onChange([...rules, { ...EMPTY_RULE, conditionType: conditionTypes[0]?.value ?? "" }]);
  }

  return (
    <div>
      {rules.map((rule, index) => (
        <div key={index} style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.sm, alignItems: "center" }}>
          <Select
            aria-label="Condition type"
            options={conditionTypeOptions}
            value={rule.conditionType}
            onChange={(e) => updateRule(index, { conditionType: e.target.value })}
            style={{ flex: 2 }}
          />
          <Select
            aria-label="Operator"
            options={operatorOptions}
            value={rule.operator}
            onChange={(e) => updateRule(index, { operator: e.target.value })}
            style={{ flex: 1 }}
          />
          <Input
            aria-label="Value"
            value={rule.value}
            onChange={(e) => updateRule(index, { value: e.target.value })}
            placeholder={rule.operator === "in" ? "comma,separated,values" : "value"}
            style={{ flex: 2 }}
          />
          <Button variant="danger" onClick={() => removeRule(index)} type="button">
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" onClick={addRule} type="button">
        Add condition
      </Button>
      {rules.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: "0.875rem", marginTop: spacing.sm }}>
          No conditions yet — a segment with zero conditions matches zero customers.
        </div>
      ) : null}
    </div>
  );
}
