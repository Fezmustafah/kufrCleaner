export class StringWrapper {
  constructor(private value: string) {
    this.contains = this.contains.bind(this);
    this.containsAny = this.containsAny.bind(this);
    this.containsAll = this.containsAll.bind(this);
    this.startsWith = this.startsWith.bind(this);
    this.endsWith = this.endsWith.bind(this);
    this.isEmpty = this.isEmpty.bind(this);
    this.lower = this.lower.bind(this);
    this.upper = this.upper.bind(this);
    this.trim = this.trim.bind(this);
  }
  contains(s: string): boolean { return this.value.includes(s); }
  containsAny(...values: string[]): boolean { return values.some((v) => this.value.includes(v)); }
  containsAll(...values: string[]): boolean { return values.every((v) => this.value.includes(v)); }
  startsWith(s: string): boolean { return this.value.startsWith(s); }
  endsWith(s: string): boolean { return this.value.endsWith(s); }
  isEmpty(): boolean { return this.value.length === 0; }
  lower(): string { return this.value.toLowerCase(); }
  upper(): string { return this.value.toUpperCase(); }
  trim(): string { return this.value.trim(); }
  get length(): number { return this.value.length; }
  toString(): string { return this.value; }
  valueOf(): string { return this.value; }
}

export class ListWrapper<T = any> {
  constructor(private value: T[]) {
    this.contains = this.contains.bind(this);
    this.containsAny = this.containsAny.bind(this);
    this.containsAll = this.containsAll.bind(this);
    this.isEmpty = this.isEmpty.bind(this);
    this.join = this.join.bind(this);
  }
  contains(item: T): boolean { return this.value.includes(item); }
  containsAny(...items: T[]): boolean { return items.some((i) => this.value.includes(i)); }
  containsAll(...items: T[]): boolean { return items.every((i) => this.value.includes(i)); }
  isEmpty(): boolean { return this.value.length === 0; }
  join(separator = ","): string { return this.value.join(separator); }
  get length(): number { return this.value.length; }
  [Symbol.iterator]() { return this.value[Symbol.iterator](); }
  toString(): string { return this.value.toString(); }
  valueOf(): T[] { return this.value; }
}

export class DateWrapper {
  constructor(private value: Date | undefined) {
    this.isEmpty = this.isEmpty.bind(this);
  }
  get year(): number { return this.value?.getFullYear() ?? 0; }
  get month(): number { return this.value ? this.value.getMonth() + 1 : 0; }
  get day(): number { return this.value?.getDate() ?? 0; }
  get hour(): number { return this.value?.getHours() ?? 0; }
  get minute(): number { return this.value?.getMinutes() ?? 0; }
  get second(): number { return this.value?.getSeconds() ?? 0; }
  isEmpty(): boolean { return this.value === undefined || this.value === null; }
  valueOf(): number { return this.value?.getTime() ?? 0; }
  toString(): string { return this.value?.toISOString() ?? ""; }
}

export function wrapString(value: string): StringWrapper { return new StringWrapper(value); }
export function wrapList<T = any>(value: T[]): ListWrapper<T> { return new ListWrapper(value); }
export function wrapDate(value: Date | undefined): DateWrapper { return new DateWrapper(value); }
