import type { Client } from "../client";

type MaybePromise<T> = T | Promise<T>;

export type ConditionPredicate<TEvent> = (client: Client, event: TEvent) => MaybePromise<boolean>;

export class Condition<TEvent> {
  readonly label: string;
  private readonly predicate: ConditionPredicate<TEvent>;

  constructor(predicate: ConditionPredicate<TEvent>, label = "Condition") {
    this.predicate = predicate;
    this.label = label;
  }

  async matches(client: Client, event: TEvent): Promise<boolean> {
    return await this.predicate(client, event);
  }

  and(other: Condition<TEvent>): Condition<TEvent> {
    return new Condition<TEvent>(async (client, event) => {
      return (await this.matches(client, event)) && (await other.matches(client, event));
    }, `All(${this.label}, ${other.label})`);
  }

  or(other: Condition<TEvent>): Condition<TEvent> {
    return new Condition<TEvent>(async (client, event) => {
      return (await this.matches(client, event)) || (await other.matches(client, event));
    }, `Any(${this.label}, ${other.label})`);
  }

  not(): Condition<TEvent> {
    return new Condition<TEvent>(async (client, event) => {
      return !(await this.matches(client, event));
    }, `Not(${this.label})`);
  }
}

export function create<TEvent>(
  predicate: ConditionPredicate<TEvent>,
  label?: string,
): Condition<TEvent> {
  return new Condition(predicate, label);
}

export function all<TEvent>(...conditions: Condition<TEvent>[]): Condition<TEvent> {
  return new Condition<TEvent>(async (client, event) => {
    for (const condition of conditions) {
      if (!(await condition.matches(client, event))) {
        return false;
      }
    }

    return true;
  }, `All(${conditions.map((condition) => condition.label).join(", ")})`);
}

export function any<TEvent>(...conditions: Condition<TEvent>[]): Condition<TEvent> {
  return new Condition<TEvent>(async (client, event) => {
    for (const condition of conditions) {
      if (await condition.matches(client, event)) {
        return true;
      }
    }

    return false;
  }, `Any(${conditions.map((condition) => condition.label).join(", ")})`);
}

export function not<TEvent>(condition: Condition<TEvent>): Condition<TEvent> {
  return condition.not();
}
