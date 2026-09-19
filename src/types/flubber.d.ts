// flubber ships no types. Only the two calls the step player makes are declared;
// with `single: true` both return one interpolator over the whole shape.
declare module "flubber" {
  export type Interpolator = (t: number) => string;
  export interface InterpolateOptions {
    maxSegmentLength?: number;
    string?: boolean;
    single?: boolean;
  }
  export function separate(from: string, to: string[], options?: InterpolateOptions): Interpolator;
  export function combine(from: string[], to: string, options?: InterpolateOptions): Interpolator;
}
