declare module "jexl" {
  export class Jexl {
    addFunction(name: string, fn: (...args: any[]) => any): void;
    addTransform(name: string, fn: (...args: any[]) => any): void;
    evalSync(expression: string, context?: Record<string, unknown>): any;
    eval(expression: string, context?: Record<string, unknown>): Promise<any>;
  }
  const jexl: { Jexl: typeof Jexl; expr: (str: string) => any };
  export default jexl;
}
